<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Модерация текста через Sightengine (text/check.json).
 *
 * Дополнение к локальному ContentModeration (Blasp + словари):
 * внешний сервис ловит обфускации и темы, которых нет в наших
 * словарях — сексуальный контент и педофилия (profanity.sexual,
 * ml sexual), насилие и угрозы (violence, ml violent), наркотики
 * (drug), оружие (weapon), разжигание ненависти и экстремизм
 * (extremism, ml discriminatory), селфхарм (self-harm).
 *
 * Запрос один, оба режима сразу: mode=rules,ml. Языки ru+en —
 * сервис сам определяет язык из списка.
 *
 * Политика отказов (fail-open) — как у PhotoModerationService:
 * при недоступности API, таймауте или пустых ключах текст
 * пропускается, факт пишется в лог. Локальный ContentModeration
 * остаётся первым барьером и работает всегда.
 *
 * Пример вызова:
 *   TextModerationService::assertClean($body);
 *
 * @see https://sightengine.com/docs/text-moderation-rule-based
 * @see https://sightengine.com/docs/text-moderation-ml-models
 */
class TextModerationService
{
    /** Единая точка текст-модерации Sightengine. */
    private const ENDPOINT = 'https://api.sightengine.com/1.0/text/check.json';

    /**
     * Правило-категории для mode=rules: запрещённый контент Pipe.
     *
     * self-harm здесь как правило: ML-модель self-harm не поддерживает
     * русский язык (ошибка 6091), а rule-категория работает.
     */
    private const RULE_CATEGORIES = 'profanity,drug,weapon,violence,extremism,self-harm';

    /** ML-модели для mode=ml: общий классификатор (sexual/violent/discriminatory/toxic). */
    private const ML_MODELS = 'general';

    /** Языки текста: русский и английский. */
    private const LANG = 'ru,en';

    /** Сообщение об отказе: единое для всех блокировок текста. */
    private const REJECT_MESSAGE = 'Неприемлемый контент — публикация запрещена.';

    /**
     * Проверить текст и отклонить публикацию при запрещённом контенте (422).
     *
     * Проверяются ВСЕ авторы, включая админов и модераторов: их контент
     * попадает в публичную ленту, правила едины для всех.
     *
     * @param string $text текст публикации
     * @return void
     * @throws ValidationException 422 — поле content, сообщение «Неприемлемый контент…»
     */
    public static function assertClean(string $text): void
    {
        $verdict = self::check($text);

        if ($verdict['allowed']) {
            return;
        }

        throw ValidationException::withMessages([
            'content' => self::REJECT_MESSAGE,
        ]);
    }

    /**
     * Сообщение модерации для форм/тостов.
     *
     * @return string текст единого отказа
     */
    public static function rejectMessage(): string
    {
        return self::REJECT_MESSAGE;
    }

    /**
     * Проверить текст через Sightengine (rules + ml).
     *
     * @param string $text текст публикации
     * @return array{allowed: bool, reasons: list<string>, skipped: bool}
     *     allowed — можно публиковать; reasons — человеческие причины отказа;
     *     skipped — проверка не выполнялась (нет ключей/сбой API)
     */
    public static function check(string $text): array
    {
        $trimmed = trim($text);

        if ($trimmed === '') {
            return self::verdict(allowed: true, reasons: [], skipped: true);
        }

        $apiUser = trim((string) config('services.sightengine.api_user'));
        $apiKey = trim((string) config('services.sightengine.api_key'));

        if ($apiUser === '' || $apiKey === '') {
            return self::verdict(allowed: true, reasons: [], skipped: true);
        }

        $payload = self::request($trimmed, $apiUser, $apiKey);

        if ($payload === null) {
            // Fail-open: сбой внешнего сервиса не должен ломать публикацию.
            return self::verdict(allowed: true, reasons: [], skipped: true);
        }

        return self::evaluate($payload);
    }

    /**
     * Отправить текст в Sightengine и разобрать ответ.
     *
     * @param string $text текст публикации
     * @param string $apiUser api_user из dashboard
     * @param string $apiKey api_secret из dashboard
     * @return array<string, mixed>|null JSON ответа либо null при сбое
     */
    private static function request(string $text, string $apiUser, string $apiKey): ?array
    {
        $timeout = max(5, (int) config('services.sightengine.timeout', 20));

        try {
            $response = Http::asMultipart()
                ->timeout($timeout)
                ->post(self::ENDPOINT, [
                    ['name' => 'text', 'contents' => $text],
                    ['name' => 'mode', 'contents' => 'rules,ml'],
                    ['name' => 'categories', 'contents' => self::RULE_CATEGORIES],
                    ['name' => 'models', 'contents' => self::ML_MODELS],
                    ['name' => 'lang', 'contents' => self::LANG],
                    ['name' => 'api_user', 'contents' => $apiUser],
                    ['name' => 'api_secret', 'contents' => $apiKey],
                ]);
        } catch (\Throwable $error) {
            Log::warning('sightengine text request failed: '.$error->getMessage());

            return null;
        }

        if (! $response->successful()) {
            Log::warning('sightengine text http error', [
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            return null;
        }

        $payload = $response->json();

        if (! is_array($payload) || ($payload['status'] ?? '') !== 'success') {
            Log::warning('sightengine text bad response', [
                'body' => mb_substr(json_encode($payload) ?: '', 0, 300),
            ]);

            return null;
        }

        return $payload;
    }

    /**
     * Оценить ответ Sightengine: rule-совпадения + ML-оценки.
     *
     * Ответ смешанный:
     * - правила: ключи категорий (profanity, violence, ...) со
     *   вложенным matches[] (каждый матч имеет category/type);
     * - ml: ключ general с оценками классов 0–1 и self-harm с оценкой.
     *
     * @param array<string, mixed> $payload успешный JSON ответа
     * @return array{allowed: bool, reasons: list<string>, skipped: bool}
     */
    private static function evaluate(array $payload): array
    {
        $reasons = self::ruleReasons($payload);
        $reasons = [...$reasons, ...self::mlReasons($payload)];
        $reasons = array_values(array_unique($reasons));

        $allowed = $reasons === [];

        if (! $allowed) {
            Log::notice('sightengine blocked text', [
                'reasons' => $reasons,
            ]);
        }

        return self::verdict(allowed: $allowed, reasons: $reasons, skipped: false);
    }

    /**
     * Причины по rule-категориям (mode=rules).
     *
     * Категория считается нарушением, если в её matches есть
     * хоть один матч нужного типа.
     *
     * @param array<string, mixed> $payload ответ API
     * @return list<string> человеческие причины
     */
    private static function ruleReasons(array $payload): array
    {
        $categoryMessages = [
            'profanity' => 'нецензурный или сексуальный текст запрещён правилами',
            'drug' => 'упоминание наркотиков запрещено правилами',
            'weapon' => 'упоминание оружия запрещено правилами',
            'violence' => 'угрозы и описание насилия запрещены правилами',
            'extremism' => 'экстремистский контент запрещён правилами',
            'self-harm' => 'упоминания суицида и селфхарма запрещены правилами',
        ];

        $reasons = [];

        foreach ($categoryMessages as $category => $message) {
            $block = is_array($payload[$category] ?? null) ? $payload[$category] : [];
            $matches = is_array($block['matches'] ?? null) ? $block['matches'] : [];

            if ($matches !== [] && self::hasForbiddenMatchType($category, $matches)) {
                $reasons[] = $message;
            }
        }

        return $reasons;
    }

    /**
     * Есть ли в матчах категории запрещённый тип.
     *
     * У profanity пропускаем «insult» и «grawlix» — лёгкие ругательства
     * ловит локальный фильтр, а слишком широкий фильтр валит бытовые
     * тексты Pipe; остальные типы (sexual, discriminatory, inappropriate)
     * запрещены целиком. Для остальных категорий важен любой матч.
     *
     * @param string $category категория правил
     * @param array<int, mixed> $matches матчи категории
     */
    private static function hasForbiddenMatchType(string $category, array $matches): bool
    {
        if ($category !== 'profanity') {
            return true;
        }

        foreach ($matches as $match) {
            $type = is_array($match) ? (string) ($match['type'] ?? '') : '';

            if ($type !== 'insult' && $type !== 'grawlix') {
                return true;
            }
        }

        return false;
    }

    /**
     * Причины по ML-оценкам (mode=ml, модель general).
     *
     * Оценки приходят в объекте moderation_classes (плюс дублируются
     * топ-уровнем), парсим moderation_classes с fallback на «general».
     *
     * @param array<string, mixed> $payload ответ API
     * @return list<string> человеческие причины
     */
    private static function mlReasons(array $payload): array
    {
        $thresholds = self::thresholds();

        $scores = is_array($payload['moderation_classes'] ?? null)
            ? $payload['moderation_classes']
            : (is_array($payload['general'] ?? null) ? $payload['general'] : []);

        $reasons = [];

        $sexual = (float) ($scores['sexual'] ?? 0.0);

        if ($sexual >= $thresholds['sexual']) {
            $reasons[] = 'сексуальный контент запрещён правилами';
        }

        $violent = (float) ($scores['violent'] ?? 0.0);

        if ($violent >= $thresholds['violent']) {
            $reasons[] = 'насилие и жестокость запрещены правилами';
        }

        $discriminatory = (float) ($scores['discriminatory'] ?? 0.0);

        if ($discriminatory >= $thresholds['discriminatory']) {
            $reasons[] = 'разжигание ненависти запрещено правилами';
        }

        return $reasons;
    }

    /**
     * Пороги ML-оценок из конфига с безопасными дефолтами.
     *
     * @return array<string, float>
     */
    private static function thresholds(): array
    {
        $configured = config('services.sightengine.text_thresholds', []);
        $configured = is_array($configured) ? $configured : [];

        $defaults = [
            'sexual' => 0.60,
            'violent' => 0.60,
            'discriminatory' => 0.60,
        ];

        $resolved = [];

        foreach ($defaults as $name => $default) {
            $value = (float) ($configured[$name] ?? $default);
            $resolved[$name] = max(0.0, min(1.0, $value));
        }

        return $resolved;
    }

    /**
     * Единая форма вердикта.
     *
     * @param bool $allowed можно ли публиковать текст
     * @param list<string> $reasons человеческие причины отказа
     * @param bool $skipped проверка не выполнялась (нет ключей либо сбой API)
     * @return array{allowed: bool, reasons: list<string>, skipped: bool}
     */
    private static function verdict(bool $allowed, array $reasons, bool $skipped): array
    {
        return [
            'allowed' => $allowed,
            'reasons' => $reasons,
            'skipped' => $skipped,
        ];
    }
}
