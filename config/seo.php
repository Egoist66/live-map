<?php

return [
    'site_name' => env('APP_NAME', 'UPin'),
    'title_suffix' => ' — UPin',
    'default_title' => 'UPin — Твоё окно во двор | Живая карта района',
    'default_description' => 'UPin — гиперлокальная карта твоего района. Пины соседей в радиусе 5 км: вопросы, события, помощь, объявления. Приватность 200 м, анонимно, без спама. Free 4ч · Pro 12ч · Business ∞.',
    'keywords' => ['UPin', 'живая карта', 'карта района', 'соседи', 'пины', 'гиперлокальная сеть', 'объявления рядом', 'помощь соседей', 'события рядом'],
    'author' => 'UPin',
    'locale' => 'ru_RU',
    'og_type' => 'website',
    'twitter_card' => 'summary_large_image',
    'theme_color' => '#0F172A',
    'image' => '/og-cover.jpg',
    'twitter_site' => null,
    'robots' => env('APP_ENV') === 'production' ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow',
];
