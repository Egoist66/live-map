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
];
