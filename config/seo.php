<?php

return [
    'site_name' => env('APP_NAME', 'UPin'),
    'title_suffix' => ' — UPin',
    'default_title' => 'UPin — знакомства ULove рядом | Живая карта встреч',
    'default_description' => 'UPin — живая карта и знакомства ULove рядом: свайпы, мэтч открывает чат, пины зовут на встречу в 2 клика. Единомышленники поблизости, приватность 200 м, анонимно, без спама.',
    'keywords' => ['UPin', 'ULove', 'знакомства рядом', 'свайпы', 'мэтч', 'живая карта', 'пины', 'события рядом'],
    'author' => 'UPin',
    'support_email' => env('MAIL_FROM_ADDRESS', 'support@ulove.app'),
    'locale' => 'ru_RU',
    'og_type' => 'website',
    'twitter_card' => 'summary_large_image',
    'theme_color' => '#FD267D',
    'image' => '/og-cover.jpg',
    'twitter_site' => null,
    'robots' => env('APP_ENV') === 'production' ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow',
];
