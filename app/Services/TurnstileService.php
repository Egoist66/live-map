<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Проверка Cloudflare Turnstile на бэке.
 *
 * Фронт (useTurnstile) кладёт токен виджета в поле `captcha_token`,
 * контроллеры валидируют его правилом ValidTurnstile, которое зовёт сюда.
 *
 * Когда ключи не заданы (локальный dev без Cloudflare) — проверка
 * пропускает всех: isEnabled() === false. В проде без ключей капча
 * тоже пропустит, но об этом пишется warning в лог при каждой проверке.
 */
class TurnstileService
{
    /**
     * Эндпоинт проверки токенов Cloudflare.
     */
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    /**
     * Включена ли капча (есть оба ключа и не выключена флагом).
     *
     * @return bool true — токены реально проверяются у Cloudflare
     */
    public static function isEnabled(): bool
    {
        if (! (bool) config('captcha.enabled', true)) {
            return false;
        }

        $siteKey = trim((string) config('captcha.turnstile_site_key', ''));
        $secret = trim((string) config('captcha.turnstile_secret', ''));

        return $siteKey !== '' && $secret !== '';
    }

    /**
     * Публичный ключ для виджета (уходит на фронт через Inertia shared props).
     *
     * @return string sitekey или пустая строка, когда капча выключена
     */
    public static function siteKey(): string
    {
        if (! self::isEnabled()) {
            return '';
        }

        return trim((string) config('captcha.turnstile_site_key', ''));
    }

    /**
     * Проверить токен виджета у Cloudflare.
     *
     * Fail-open только когда капча не настроена (dev). Когда настроена,
     * любая ошибка сети трактуется как провал — иначе боты обходили бы
     * капчу глушением исходящих запросов.
     *
     * @param string|null $token токен из поля `captcha_token`
     * @param string|null $ip IP клиента для привязки проверки
     * @return bool true — человек, false — бот/просроченный токен/ошибка
     */
    public static function verify(?string $token, ?string $ip = null): bool
    {
        $token = trim((string) $token);

        if (! self::isEnabled()) {
            Log::warning('turnstile skipped: keys not configured');

            return true;
        }

        if ($token === '') {
            return false;
        }

        $payload = [
            'secret' => (string) config('captcha.turnstile_secret'),
            'response' => $token,
        ];

        $clientIp = trim((string) $ip);

        if ($clientIp !== '') {
            $payload['remoteip'] = $clientIp;
        }

        try {
            $timeout = (int) config('captcha.verify_timeout', 5);

            $response = Http::timeout(max(1, $timeout))
                ->asForm()
                ->post(self::VERIFY_URL, $payload);

            if (! $response->ok()) {
                Log::warning('turnstile verify http failed', ['status' => $response->status()]);

                return false;
            }

            $success = (bool) $response->json('success', false);

            if (! $success) {
                $codes = $response->json('error-codes', []);

                Log::info('turnstile verify rejected', ['codes' => $codes]);
            }

            return $success;
        } catch (\Throwable $e) {
            Log::warning('turnstile verify network failed', ['error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Заполнено ли honeypot-поле (дешёвый маркер ботов).
     *
     * Поле `website` скрыто CSS на всех гостевых формах: человек его
     * не видит и не заполняет, примитивный бот льёт туда URL.
     *
     * @param mixed $value значение поля `website` из запроса
     * @return bool true — 100% бот
     */
    public static function honeypotFilled(mixed $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }
}
