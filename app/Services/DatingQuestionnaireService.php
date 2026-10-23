<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use JsonException;

/**
 * Анкета ULove: нормализация, модерация и перенос между устройствами.
 *
 * Сервис держит единые правила для PATCH /api/swipes/settings и импорта
 * файла: обрезка пробелов, нижний регистр интересов, лимиты полей и
 * проверка через ContentModeration. Экспорт — переносимый JSON с версией,
 * чтобы будущие изменения формата можно было поддержать без догадок.
 */
class DatingQuestionnaireService
{
    /** Маркер формата: по нему отличаем свою анкету от чужого JSON. */
    public const EXPORT_FORMAT = 'ulove.questionnaire';

    /** Версия схемы экспорта. */
    public const EXPORT_VERSION = 1;

    /** Максимальный размер файла импорта в байтах. */
    public const MAX_IMPORT_BYTES = 65536;

    /** Допустимые цели знакомства. */
    private const GOALS = ['love', 'flirt', 'friendship', 'chat', 'interests'];

    /** Максимум интересов в анкете. */
    private const INTERESTS_LIMIT = 10;

    /** Максимальная длина одного интереса. */
    private const INTEREST_LENGTH = 40;

    /** Поля, которые считаются содержимым анкеты. */
    private const QUESTIONNAIRE_KEYS = [
        'dating_enabled',
        'dating_goal',
        'dating_custom_goal',
        'dating_about',
        'dating_interests',
    ];

    /**
     * Привести поля анкеты к единому виду.
     *
     * Меняет только переданные ключи: PATCH приватности не должен
     * затирать тексты анкеты. Интересы чистятся от пустых дублей,
     * приводятся к нижнему регистру и обрезаются по лимитам.
     *
     * @param  array<string, mixed>  $data  валидированные поля
     * @return array<string, mixed> нормализованные поля
     */
    public function normalize(array $data): array
    {
        if (array_key_exists('dating_custom_goal', $data)) {
            $customGoal = trim((string) ($data['dating_custom_goal'] ?? ''));
            $data['dating_custom_goal'] = $customGoal !== '' ? $customGoal : null;
        }

        if (array_key_exists('dating_about', $data)) {
            $about = trim((string) ($data['dating_about'] ?? ''));
            $data['dating_about'] = $about !== '' ? $about : null;
        }

        if (array_key_exists('dating_interests', $data)) {
            $data['dating_interests'] = $this->normalizeInterests($data['dating_interests']);
        }

        if (array_key_exists('dating_enabled', $data)) {
            $data['dating_enabled'] = (bool) $data['dating_enabled'];
        }

        return $data;
    }

    /**
     * Проверить тексты анкеты через ContentModeration (Blasp + темы).
     *
     * @param  array<string, mixed>  $data  нормализованные поля
     * @return void
     *
     * @throws ValidationException 422 — ошибка в ключе content
     */
    public function assertClean(array $data): void
    {
        $interests = $data['dating_interests'] ?? [];
        $interestTexts = is_array($interests) ? array_values($interests) : [];

        ContentModeration::assertClean(
            $data['dating_about'] ?? null,
            $data['dating_custom_goal'] ?? null,
            ...$interestTexts,
        );
    }

    /**
     * Собрать переносимый JSON анкеты.
     *
     * @param  User  $user  владелец анкеты
     * @return array<string, mixed> формат, версия, дата и данные
     */
    public function export(User $user): array
    {
        $interests = is_array($user->dating_interests) ? $user->dating_interests : [];

        return [
            'format' => self::EXPORT_FORMAT,
            'version' => self::EXPORT_VERSION,
            'exported_at' => now()->toIso8601String(),
            'data' => [
                'dating_enabled' => (bool) $user->dating_enabled,
                'dating_goal' => $user->dating_goal,
                'dating_custom_goal' => $user->dating_custom_goal,
                'dating_about' => $user->dating_about,
                'dating_interests' => array_values($interests),
            ],
        ];
    }

    /**
     * Разобрать и проверить файл импорта.
     *
     * @param  string  $contents  содержимое JSON-файла
     * @return array<string, mixed> нормализованные и проверенные поля
     *
     * @throws ValidationException 422 — битый файл или недопустимые поля
     */
    public function parseImport(string $contents): array
    {
        $this->assertFileSize($contents);

        $payload = $this->decodeJson($contents);
        $this->assertFormat($payload);

        $data = $payload['data'] ?? null;

        if (! is_array($data)) {
            throw ValidationException::withMessages([
                'file' => 'В файле нет данных анкеты.',
            ]);
        }

        $knownKeys = array_intersect_key($data, array_flip(self::QUESTIONNAIRE_KEYS));

        if ($knownKeys === []) {
            throw ValidationException::withMessages([
                'file' => 'В файле нет полей анкеты ULove.',
            ]);
        }

        $validated = Validator::make($data, $this->importRules(), $this->importMessages())->validate();
        $normalized = $this->normalize($validated);

        $this->assertClean($normalized);

        return $normalized;
    }

    /**
     * Сохранить импортированные поля в анкету пользователя.
     *
     * @param  User  $user  владелец анкеты
     * @param  array<string, mixed>  $data  нормализованные поля
     * @return void
     */
    public function apply(User $user, array $data): void
    {
        $user->update($data);
    }

    /**
     * Нормализовать интересы: lower-case, без пустых и дублей.
     *
     * @param  mixed  $interests  массив из запроса или файла
     * @return list<string> очищенные интересы
     */
    private function normalizeInterests(mixed $interests): array
    {
        if (! is_array($interests)) {
            return [];
        }

        $cleaned = [];

        foreach ($interests as $interest) {
            $tag = mb_strtolower(trim((string) $interest));

            if ($tag === '' || in_array($tag, $cleaned, true)) {
                continue;
            }

            $cleaned[] = mb_substr($tag, 0, self::INTEREST_LENGTH);
        }

        return array_values(array_slice($cleaned, 0, self::INTERESTS_LIMIT));
    }

    /**
     * Проверить размер файла до разбора JSON.
     *
     * @param  string  $contents  содержимое файла
     * @return void
     *
     * @throws ValidationException 422 — файл больше лимита
     */
    private function assertFileSize(string $contents): void
    {
        if (strlen($contents) > self::MAX_IMPORT_BYTES) {
            throw ValidationException::withMessages([
                'file' => 'Файл анкеты больше 64 КБ.',
            ]);
        }
    }

    /**
     * Декодировать JSON с понятной ошибкой для пользователя.
     *
     * @param  string  $contents  содержимое файла
     * @return array<string, mixed> декодированный объект
     *
     * @throws ValidationException 422 — некорректный JSON
     */
    private function decodeJson(string $contents): array
    {
        if (str_starts_with($contents, "\xEF\xBB\xBF")) {
            $contents = substr($contents, 3);
        }

        try {
            $payload = json_decode($contents, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw ValidationException::withMessages([
                'file' => 'Не удалось прочитать JSON. Скачайте файл анкеты заново.',
            ]);
        }

        if (! is_array($payload)) {
            throw ValidationException::withMessages([
                'file' => 'Файл анкеты должен содержать JSON-объект.',
            ]);
        }

        return $payload;
    }

    /**
     * Проверить маркер и версию формата.
     *
     * @param  array<string, mixed>  $payload  декодированный файл
     * @return void
     *
     * @throws ValidationException 422 — чужой формат или старая версия
     */
    private function assertFormat(array $payload): void
    {
        $format = $payload['format'] ?? null;
        $version = (int) ($payload['version'] ?? 0);

        if ($format !== self::EXPORT_FORMAT) {
            throw ValidationException::withMessages([
                'file' => 'Это не файл анкеты ULove.',
            ]);
        }

        if ($version !== self::EXPORT_VERSION) {
            throw ValidationException::withMessages([
                'file' => 'Версия файла анкеты не поддерживается. Обновите приложение.',
            ]);
        }
    }

    /**
     * Правила валидации полей импорта.
     *
     * @return array<string, mixed>
     */
    private function importRules(): array
    {
        return [
            'dating_enabled' => ['sometimes', 'boolean'],
            'dating_goal' => ['nullable', 'in:'.implode(',', self::GOALS)],
            'dating_custom_goal' => ['nullable', 'string', 'max:60'],
            'dating_about' => ['nullable', 'string', 'max:1000'],
            'dating_interests' => ['nullable', 'array', 'max:'.self::INTERESTS_LIMIT],
            'dating_interests.*' => ['string', 'max:'.self::INTEREST_LENGTH],
        ];
    }

    /**
     * Русские сообщения для ошибок импорта.
     *
     * @return array<string, string>
     */
    private function importMessages(): array
    {
        return [
            'dating_goal.in' => 'В файле неизвестная цель знакомства.',
            'dating_custom_goal.max' => 'Своя цель длиннее 60 символов.',
            'dating_about.max' => 'Текст «О себе» длиннее 1000 символов.',
            'dating_interests.max' => 'В анкете больше 10 интересов.',
            'dating_interests.*.max' => 'Один из интересов длиннее 40 символов.',
            'dating_interests.*.string' => 'Интересы должны быть строками.',
        ];
    }
}
