<?php

return [
    'site_name' => env('APP_NAME', 'UPin'),
    'title_suffix' => ' — UPin',
    'default_title' => 'ULove — знакомства рядом',
    'default_description' => 'ULove — знакомства рядом: свайпы, мэтч открывает чат. Листай людей рядом, лайкай в один тап, переписывайся только по взаимности. Строго 18+.',
    'keywords' => ['ULove', 'знакомства рядом', 'свайпы', 'мэтч', 'дейтинг'],
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
