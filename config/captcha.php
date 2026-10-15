<?php

/**
 * Настройки капчи (Cloudflare Turnstile) и антибот-защиты.
 *
 * Turnstile выбран вместо reCAPTCHA: бесплатный, без трекинга Google,
 * работает из РБ/СНГ, виджет ненавязчивый (managed).
 *
 * Ключи: https://dash.cloudflare.com → Turnstile → Add widget.
 * Публичный sitekey уходит на фронт (Inertia shared props `captcha`),
 * секретный — только серверная проверка в TurnstileService.
 */
return [
    /*
    |--------------------------------------------------------------------------
    | Cloudflare Turnstile
    |--------------------------------------------------------------------------
    */
    'turnstile_site_key' => env('TURNSTILE_SITE_KEY', ''),
    'turnstile_secret' => env('TURNSTILE_SECRET_KEY', ''),

    /**
     * Принудительно выключить капчу (например, для e2e-тестов).
     * В dev без ключей капча и так пропускает (isEnabled() === false).
     */
    'enabled' => env('TURNSTILE_ENABLED', true),

    /**
     * Таймаут проверки токена у Cloudflare, секунды.
     */
    'verify_timeout' => (int) env('TURNSTILE_VERIFY_TIMEOUT', 5),
];
