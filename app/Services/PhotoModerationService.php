<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Модерация фотографий профиля через Sightengine (dashboard.sightengine.com).
 *
 * Проверяет загружаемые аватар и фото галереи на запрещённый контент:
 * откровенная обнажённость и секс (nudity-2.1), насилие и трупы (gore-2.0),
 * оружие (weapon), наркотики (recreational-drug), несовершеннолетние
 * (face-attributes, плюс nudity-2.1 сам ловит секс с minor).
 *
 * Работает одинаково локально и на проде: это исходящий HTTPS-запрос
 * к api.sightengine.com, ключи берутся из .env (SIGHTENGINE_API_USER /
 * SIGHTENGINE_API_KEY) — на проде их достаточно задать в переменных
 * окружения (laravel.cloud → Environment).
 *
 * Политика отказов (fail-open): при недоступности API, таймауте или
 * пустых ключах фото пропускается, но факт пишется в лог — лучше
 * не сломать загрузку всем, чем пропустить одно фото (его добьёт
 * жалоба и ручная модерация).
 *
 * Пример вызова:
 *   PhotoModerationService::assertAllowed($request->file('avatar'));
 *
 * @see https://docs.sightengine.com/docs/detect-nudity-and-adult-content
 */
class PhotoModerationService
{
    /** Единая точка мульти-модели Sightengine. */
    private const ENDPOINT = 'https://api.sightengine.com/1.0/check.json';

    /**
     * Набор моделей: обнажённость/секс, насилие, оружие, наркотики,
     * лица с оценкой возраста (minor).
     */
    private const MODELS = 'nudity-2.1,gore-2.0,weapon,recreational_drug,face-attributes';

    /**
     * Проверить фото и отклонить загрузку при запрещённом контенте (422).
     *
     * Стафф (админ/модератор) не проверяется — по аналогии с
     * ContentModeration::assertClean: их контент доверенный,
     * а самим сотрудникам нужно тестировать загрузку.
     *
     * @param UploadedFile $file загруженный файл изображения
     * @return void
     * @throws \Illuminate\Http\Exceptions\HttpResponseException 422 при запрете
     */
    public static function assertAllowed(UploadedFile $file): void
    {
        try {
            if (auth()->user()?->canModerate()) {
                return;
            }
        } catch (\Throwable) {
            // Нет сессии (CLI, сиды) — проверяем как обычного пользователя.
        }

        $verdict = self::check($file);

        if ($verdict['allowed']) {
            return;
        }

        abort(422, 'Фото отклонено модерацией: '.$verdict['reasons'][0]);
    }

    /**
     * Проверить изображение через Sightengine.
     *
     * @param UploadedFile $file загруженный файл изображения
     * @return array{allowed: bool, reasons: list<string>, skipped: bool}
     *     allowed — можно публиковать; reasons — человеческие причины отказа;
     *     skipped — проверка не выполнялась (нет ключей/сбой API)
     */
    public static function check(UploadedFile $file): array
    {
        $apiUser = trim((string) config('services.sightengine.api_user'));
        $apiKey = trim((string) config('services.sightengine.api_key'));

        if ($apiUser === '' || $apiKey === '') {
            return self::verdict(allowed: true, reasons: [], skipped: true);
        }

        $payload = self::request($file, $apiUser, $apiKey);

        if ($payload === null) {
            // Fail-open: сбой API не должен ломать загрузку фото.
            return self::verdict(allowed: true, reasons: [], skipped: true);
        }

        return self::evaluate($payload);
    }

    /**
     * Проверить изображение по публичному URL.
     *
     * Используется для аватаров из Telegram (telegram_photo_url): Sightengine
     * сам скачивает картинку по ссылке — URL должен быть публично доступен
     * (у Telegram он открыт). Политика fail-open та же: сбой API — пропускаем
     * с логом, чтобы не ломать вход через Mini App.
     *
     * @param string $url публичный URL изображения
     * @return array{allowed: bool, reasons: list<string>, skipped: bool}
     */
    public static function checkUrl(string $url): array
    {
        $apiUser = trim((string) config('services.sightengine.api_user'));
        $apiKey = trim((string) config('services.sightengine.api_key'));

        if ($apiUser === '' || $apiKey === '' || ! str_starts_with($url, 'https://')) {
            return self::verdict(allowed: true, reasons: [], skipped: true);
        }

        $payload = self::requestUrl($url, $apiUser, $apiKey);

        if ($payload === null) {
            return self::verdict(allowed: true, reasons: [], skipped: true);
        }

        return self::evaluate($payload);
    }

    /**
     * Запросить анализ изображения по URL.
     *
     * @param string $url публичный URL изображения
     * @param string $apiUser api_user из dashboard
     * @param string $apiKey api_secret из dashboard
     * @return array<string, mixed>|null JSON ответа либо null при сбое
     */
    private static function requestUrl(string $url, string $apiUser, string $apiKey): ?array
    {
        $timeout = max(5, (int) config('services.sightengine.timeout', 20));

        try {
            $response = Http::timeout($timeout)
                ->get(self::ENDPOINT, [
                    'url' => $url,
                    'models' => self::MODELS,
                    'api_user' => $apiUser,
                    'api_secret' => $apiKey,
                ]);
        } catch (\Throwable $error) {
            Log::warning('sightengine url request failed: '.$error->getMessage());

            return null;
        }

        if (! $response->successful()) {
            Log::warning('sightengine url http error', [
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            return null;
        }

        $payload = $response->json();

        if (! is_array($payload) || ($payload['status'] ?? '') !== 'success') {
            Log::warning('sightengine url bad response', [
                'url' => $url,
                'body' => mb_substr(json_encode($payload) ?: '', 0, 300),
            ]);

            return null;
        }

        return $payload;
    }

    /**
     * Отправить файл в Sightengine и разобрать ответ.
     *
     * @param UploadedFile $file файл изображения
     * @param string $apiUser api_user из dashboard
     * @param string $apiKey api_secret из dashboard
     * @return array<string, mixed>|null JSON ответа либо null при сбое
     */
    private static function request(UploadedFile $file, string $apiUser, string $apiKey): ?array
    {
        $timeout = max(5, (int) config('services.sightengine.timeout', 20));
        $fileName = $file->getClientOriginalName() ?: 'upload.jpg';

        try {
            $response = Http::asMultipart()
                ->timeout($timeout)
                ->attach('media', $file->getContent(), $fileName)
                ->post(self::ENDPOINT, [
                    'models' => self::MODELS,
                    'api_user' => $apiUser,
                    'api_secret' => $apiKey,
                ]);
        } catch (\Throwable $error) {
            Log::warning('sightengine request failed: '.$error->getMessage());

            return null;
        }

        if (! $response->successful()) {
            Log::warning('sightengine http error', [
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            return null;
        }

        $payload = $response->json();

        if (! is_array($payload) || ($payload['status'] ?? '') !== 'success') {
            Log::warning('sightengine bad response', [
                'body' => mb_substr(json_encode($payload) ?: '', 0, 300),
            ]);

            return null;
        }

        return $payload;
    }

    /**
     * Оценить ответ Sightengine по порогам из конфига.
     *
     * @param array<string, mixed> $payload успешный JSON ответа
     * @return array{allowed: bool, reasons: list<string>, skipped: bool}
     */
    private static function evaluate(array $payload): array
    {
        $reasons = [];

        $nudity = is_array($payload['nudity'] ?? null) ? $payload['nudity'] : [];
        $gore = is_array($payload['gore'] ?? null) ? $payload['gore'] : [];
        $drug = is_array($payload['recreational_drug'] ?? null) ? $payload['recreational_drug'] : [];

        $sexualActivity = (float) ($nudity['sexual_activity'] ?? 0.0);
        $sexualDisplay = (float) ($nudity['sexual_display'] ?? 0.0);
        $erotica = (float) ($nudity['erotica'] ?? 0.0);
        $sexualMinor = (float) ($nudity['sexual_activity_minor'] ?? 0.0);
        $goreProb = (float) ($gore['prob'] ?? 0.0);
        $drugProb = (float) ($drug['prob'] ?? 0.0);
        $weaponProb = self::maxWeaponProb($payload);
        $minorProb = self::maxMinorProb($payload);

        $thresholds = self::thresholds();

        if ($sexualMinor >= $thresholds['sexual_activity_minor']) {
            $reasons[] = 'на фото возможен сексуальный контент с несовершеннолетними';
        }

        if ($sexualActivity >= $thresholds['sexual_activity']) {
            $reasons[] = 'откровенный сексуальный контент запрещён правилами';
        } elseif ($sexualDisplay >= $thresholds['sexual_display']) {
            $reasons[] = 'слишком откровенное фото запрещено правилами';
        } elseif ($erotica >= $thresholds['erotica']) {
            $reasons[] = 'эротический контент запрещён правилами';
        }

        if ($goreProb >= $thresholds['gore']) {
            $reasons[] = 'сцены насилия и жестокости запрещены правилами';
        }

        if ($weaponProb >= $thresholds['weapon']) {
            $reasons[] = 'оружие на фото запрещено правилами';
        }

        if ($drugProb >= $thresholds['recreational_drug']) {
            $reasons[] = 'наркотики на фото запрещены правилами';
        }

        if ($minorProb >= $thresholds['minor_face']) {
            $reasons[] = 'на фото, вероятно, несовершеннолетний — такое фото запрещено';
        }

        $allowed = $reasons === [];

        if (! $allowed) {
            Log::notice('sightengine blocked photo', [
                'sexual_activity' => $sexualActivity,
                'sexual_display' => $sexualDisplay,
                'erotica' => $erotica,
                'sexual_activity_minor' => $sexualMinor,
                'gore' => $goreProb,
                'weapon' => $weaponProb,
                'recreational_drug' => $drugProb,
                'minor_face' => $minorProb,
                'reasons' => $reasons,
            ]);
        }

        return self::verdict(allowed: $allowed, reasons: $reasons, skipped: false);
    }

    /**
     * Максимальная уверенность по оружию среди всех классов модели weapon.
     *
     * Sightengine отдаёт объект weapon.classes:: firearm, knife,
     * firearm_gesture, firearm_toy (0–1). Берем максимум по всем
     * числовым значениям — покрывает и будущие классы.
     *
     * @param array<string, mixed> $payload ответ API
     * @return float вероятность 0–1, 0 когда оружия нет
     */
    private static function maxWeaponProb(array $payload): float
    {
        $weapon = is_array($payload['weapon'] ?? null) ? $payload['weapon'] : [];

        if (is_numeric($payload['weapon'] ?? null)) {
            return min(1.0, max(0.0, (float) $payload['weapon']));
        }

        $classes = is_array($weapon['classes'] ?? null) ? $weapon['classes'] : [];

        $maxProb = 0.0;

        foreach ($classes as $prob) {
            if (! is_numeric($prob)) {
                continue;
            }

            $maxProb = max($maxProb, (float) $prob);
        }

        return $maxProb;
    }

    /**
     * Максимальная вероятность «несовершеннолетний» среди лиц на фото.
     *
     * face-attributes отдаёт faces[].attributes.minor — оценка того,
     * что человеку меньше 18 лет.
     *
     * @param array<string, mixed> $payload ответ API
     * @return float вероятность 0–1, 0 когда лиц нет
     */
    private static function maxMinorProb(array $payload): float
    {
        $faces = $payload['faces'] ?? [];

        if (! is_array($faces)) {
            return 0.0;
        }

        $maxProb = 0.0;

        foreach ($faces as $face) {
            $attributes = is_array($face) ? ($face['attributes'] ?? []) : [];
            $prob = is_array($attributes) ? (float) ($attributes['minor'] ?? 0.0) : 0.0;
            $maxProb = max($maxProb, $prob);
        }

        return $maxProb;
    }

    /**
     * Пороги срабатывания из конфига с безопасными дефолтами.
     *
     * @return array<string, float>
     */
    private static function thresholds(): array
    {
        $configured = config('services.sightengine.thresholds', []);
        $configured = is_array($configured) ? $configured : [];

        $defaults = [
            'sexual_activity' => 0.50,
            'sexual_display' => 0.60,
            'erotica' => 0.70,
            'sexual_activity_minor' => 0.20,
            'gore' => 0.60,
            'weapon' => 0.70,
            'recreational_drug' => 0.60,
            'minor_face' => 0.80,
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
     * @param bool $allowed можно ли публиковать фото
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
