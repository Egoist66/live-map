<?php

/**
 * Тарифы приложения — единый источник правды о ценах, аудиториях и лимитах.
 *
 * Правила модели (мягкая монетизация на старте):
 * - Free закрывает ~95% жизни и не урезается; платное — только ускорение.
 * - Персоны (account_type=person): только free/pro/premium.
 * - Организации (role=organization / account_type=business): только business.
 * - Смена цены — правка этого файла, код и тексты подтягивают её сами:
 *   бэк через App\Services\PlanCatalog, фронт через GET /api/subscription/plans.
 *
 * Цены в USD. Цена одна для всех стран: PRO — $3.99/мес по умолчанию.
 */
return [

    /*
    |--------------------------------------------------------------------------
    | Сроки подписки
    |--------------------------------------------------------------------------
    */
    'period_days' => 30,
    'renewal_window_days' => 3,
    'grace_days' => 3,

    /*
    |--------------------------------------------------------------------------
    | Какие планы кому доступны
    |--------------------------------------------------------------------------
    */
    'person_plans' => ['free', 'pro', 'premium'],
    'organization_plans' => ['business'],

    /*
    |--------------------------------------------------------------------------
    | Планы
    |--------------------------------------------------------------------------
    |
    | prices: monthly — цена в месяц для всех стран, yearly — сразу на год,
    | weekly — импульсная неделя PRO (показывать только в момент азарта,
    | в настройках не светить). null — бесплатно / периода нет.
    |
    | limits: продуктовые лимиты планов. Большинство enforced в коде
    | (App\Models\User, App\Services\DatingService), исключение — anon_posts:
    | пока текстовый лимит без бэкенд-гейта. Код пока читает константы
    | классов (совместимость), этот блок — документация и будущий источник
    | (см. App\Services\PlanCatalog).
    | null — безлимит.
    |
    */
    'plans' => [

        'free' => [
            'name' => 'Free',
            'audience' => 'users',
            'tagline' => 'Чтобы жить районом и знакомиться рядом',
            'prices' => [
                'monthly' => null,
                'yearly' => null,
                'weekly' => null,
                'currency' => 'USD',
            ],
            'limits' => [
                'live_pins' => 3,
                'pin_ttl_hours' => 4,
                'pin_radius_m' => 10000,
                'home_radius_km' => 10,
                'random_chats_month' => 3,
                'favorites' => 3,
                'swipe_reset' => 1,
                'superlikes_daily' => 1,
                'undos_daily' => 1,
                'gallery_photos' => 5,
                'hidden_friends' => 1,
                'districts' => 2,
                'anon_posts' => 2,
                'pin_invites_month' => 3,
                'pinned_chats' => null,
                'pinned_messages' => 3,
            ],
        ],

        'pro' => [
            'name' => 'PRO',
            'audience' => 'users',
            'tagline' => 'Для активных знакомств: тебя видят, тебе отвечают',
            'prices' => [
                'monthly' => 3.99,
                'yearly' => 29.99,
                'weekly' => 0.99,
                'currency' => 'USD',
            ],
            'limits' => [
                'live_pins' => null,
                'pin_ttl_hours' => 12,
                'pin_radius_m' => 15000,
                'home_radius_km' => 15,
                'random_chats_month' => 20,
                'favorites' => 10,
                'swipe_reset' => null,
                'superlikes_daily' => 5,
                'undos_daily' => null,
                'gallery_photos' => 10,
                'hidden_friends' => 3,
                'districts' => 5,
                'anon_posts' => 5,
                'pin_invites_month' => null,
                'pinned_chats' => null,
                'pinned_messages' => 6,
            ],
        ],

        'premium' => [
            'name' => 'Premium',
            'audience' => 'users',
            'tagline' => 'Максимум для знакомств: всё из PRO без ограничений',
            'prices' => [
                'monthly' => 7.99,
                'yearly' => 59.99,
                'weekly' => null,
                'currency' => 'USD',
            ],
            'limits' => [
                'live_pins' => null,
                'pin_ttl_hours' => null,
                'pin_radius_m' => 50000,
                'home_radius_km' => 50,
                'random_chats_month' => 10,
                'favorites' => 15,
                'swipe_reset' => null,
                'superlikes_daily' => 5,
                'undos_daily' => null,
                'gallery_photos' => 15,
                'hidden_friends' => null,
                'districts' => 15,
                'anon_posts' => 5,
                'pin_invites_month' => null,
                'pinned_chats' => null,
                'pinned_messages' => 20,
            ],
        ],

        'business' => [
            'name' => 'Business',
            'audience' => 'organizations',
            'tagline' => 'Только для организаций: кабинет компании',
            'prices' => [
                'monthly' => 19.99,
                'yearly' => null,
                'weekly' => null,
                'currency' => 'USD',
            ],
            'limits' => [
                'live_pins' => null,
                'pin_ttl_hours' => null,
                'pin_radius_m' => 50000,
                'home_radius_km' => 50,
                'random_chats_month' => 10,
                'favorites' => 15,
                'swipe_reset' => null,
                'superlikes_daily' => 5,
                'undos_daily' => null,
                'gallery_photos' => 15,
                'hidden_friends' => null,
                'districts' => 15,
                'anon_posts' => 5,
                'pin_invites_month' => null,
                'pinned_chats' => null,
                'pinned_messages' => 20,
            ],
        ],

    ],
];
