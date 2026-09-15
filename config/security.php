<?php

/**
 * Заголовки безопасности.
 *
 * Читается App\Http\Middleware\SecurityHeaders:
 * - csp_enabled — включать ли enforcing Content-Security-Policy
 *   (по умолчанию только в production, чтобы не ломать Vite HMR в деве);
 * - hsts_max_age — max-age для Strict-Transport-Security (только поверх HTTPS);
 * - csp_extra_connect — дополнительные хосты для connect-src через запятую
 *   (например, отдельный хост Reverb), без правки кода.
 */
return [
    // app()->isProduction() здесь вызывать нельзя: конфиги грузятся раньше,
    // чем контейнер умеет резолвить окружение, — упадёт весь бут.
    'csp_enabled' => env('SECURITY_CSP_ENABLED', env('APP_ENV') === 'production'),

    'hsts_max_age' => (int) env('SECURITY_HSTS_MAX_AGE', 31536000),

    'csp_extra_connect' => array_values(array_filter(array_map(
        static fn ($host) => trim((string) $host),
        explode(',', (string) env('SECURITY_CSP_EXTRA_CONNECT', ''))
    ))),
];
