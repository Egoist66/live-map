<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'webpush' => [
        'vapid' => [
            'public_key' => env('VAPID_PUBLIC_KEY'),
            'private_key' => env('VAPID_PRIVATE_KEY'),
        ],
    ],

    'expo' => [
        'access_token' => env('EXPO_ACCESS_TOKEN'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Sightengine — модерация фотографий (аватар, галерея профиля)
    |--------------------------------------------------------------------------
    |
    | Внешний ИИ-сервис проверяет картинки на запрещённый контент:
    | nudity-2.1 (откровенная обнажённость/секс), gore-2.0 (насилие),
    | weapon (оружие), recreational-drug (наркотики), face-attributes
    | (несовершеннолетние на фото). Ключи в .env, пороги — здесь.
    |
    */

    'sightengine' => [
        'api_user' => env('SIGHTENGINE_API_USER'),
        'api_key' => env('SIGHTENGINE_API_KEY'),

        // Таймаут запроса к API, секунды.
        'timeout' => (int) env('SIGHTENGINE_TIMEOUT', 20),

        // Пороги срабатывания (0–1). Выше порога — фото отклоняется.
        // sexual_activity_minor — секс с несовершеннолетними: порог намеренно
        // низкий, такие фото блокируем при малейшем подозрении.
        'thresholds' => [
            'sexual_activity' => 0.50,
            'sexual_display' => 0.60,
            'erotica' => 0.70,
            'sexual_activity_minor' => 0.20,
            'gore' => 0.60,
            'weapon' => 0.70,
            'recreational_drug' => 0.60,
            'minor_face' => 0.80,
        ],
    ],

    'messages_crypto_key' => env('MESSAGE_CRYPTO_KEY'),

    'turn' => [
        'urls' => env('TURN_URLS', ''),
        'username' => env('TURN_USERNAME', ''),
        'credential' => env('TURN_CREDENTIAL', ''),
        'secret' => env('TURN_SECRET', ''),
    ],

];
