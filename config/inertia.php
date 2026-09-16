<?php

/**
 * Конфигурация Inertia.js.
 *
 * SSR предрендерит первый визит на Node (bootstrap/ssr/ssr.js, порт 13714),
 * дальше работает SPA-навигация. Без запущенного `inertia:start-ssr`
 * Laravel молча откатывается в CSR (пустой div#app[data-page]).
 */
return [
    'ssr' => [
        'enabled' => (bool) env('INERTIA_SSR_ENABLED', true),
        'url' => env('INERTIA_SSR_URL', 'http://127.0.0.1:13714'),
        'ensure_bundle_exists' => (bool) env('INERTIA_SSR_ENSURE_BUNDLE_EXISTS', true),
        'bundle' => base_path('bootstrap/ssr/ssr.js'),
    ],
    'testing' => [
        'ensure_pages_exist' => true,
        'page_paths' => [resource_path('js/Pages')],
        'page_extensions' => ['js', 'jsx', 'vue', 'svelte'],
    ],
];
