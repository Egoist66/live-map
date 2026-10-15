<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Telegram Mini App (WebApp)
    |--------------------------------------------------------------------------
    |
    | Токен бота @U1ove_bot используется ТОЛЬКО для проверки подписи
    | Telegram WebApp initData (HMAC-SHA256). Сам токен в git не коммитим —
    | только через env TELEGRAM_BOT_TOKEN (.env локально / секреты прода).
    |
    */

    'bot_token' => env('TELEGRAM_BOT_TOKEN', ''),

    'bot_username' => env('TELEGRAM_BOT_USERNAME', 'U1ove_bot'),

    // Максимальный возраст initData (сек). Защита от replay-атак.
    'max_age' => (int) env('TELEGRAM_INITDATA_MAX_AGE', 86400),

    // Автосоздание пользователя при первом входе через Telegram.
    'auto_register' => (bool) env('TELEGRAM_AUTO_REGISTER', true),

    // Секрет вебхука бота: уходит в setWebhook как secret_token,
    // входящие апдейты сверяем по заголовку
    // X-Telegram-Bot-Api-Secret-Token. Пусто — без проверки
    // (только для локальной отладки).
    'webhook_secret' => env('TELEGRAM_WEBHOOK_SECRET', ''),

    // Grandfather-дата обязательной анкеты: аккаунты, созданные раньше,
    // от гейта онбординга освобождены (зарегались до нововведения),
    // требование действует только для новых. Формат: Y-m-d H:i:s.
    'onboarding_required_since' => env('ONBOARDING_REQUIRED_SINCE', '2026-10-15 00:00:00'),
];
