import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { compression } from 'vite-plugin-compression2';
import path from 'path';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fileRevision(rel) {
    try {
        const full = path.resolve(__dirname, 'public', rel);
        if (!existsSync(full)) return null;
        return createHash('md5').update(readFileSync(full)).digest('hex').slice(0, 16);
    } catch {
        return null;
    }
}

export default defineConfig({
    // Dev-сервер: порт строго 5173 — без strictPort второй Vite молча
    // уезжал на 5174, а страницы продолжали ломиться на 5173 через прокси
    // и получали 504 + `Failed to fetch dynamically imported module`.
    //
    // host 0.0.0.0 обязателен в Docker: без него Vite слушает только
    // localhost контейнера и с Windows-хоста недоступен.
    // А чтобы laravel-vite-plugin писал в public/hot браузерный адрес
    // (http://localhost:5173), а не http://0.0.0.0:5173 / http://[::]:5173
    // (такие URL браузер отвергает — ERR_ADDRESS_INVALID), зафиксированы
    // origin + hmr.host.
    //
    // Windows-хост + bind-mount: inotify-события о правках файлов
    // в контейнер НЕ доходят, без polling Vite не видит изменений
    // и HMR молчит. Polling включается через VITE_WATCH_POLL=true
    // (сервис vite в docker-compose её уже выставляет), нативный
    // `pnpm dev` без переменной работает как раньше, без лишней нагрузки.
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        origin: 'http://localhost:5173',
        hmr: {
            host: 'localhost',
            port: 5173,
        },
        watch: {
            usePolling: process.env.VITE_WATCH_POLL === 'true',
            interval: 300,
        },
    },
    resolve: {
        // Одна копия Vue на весь бандл: без dedupe рантайм может разъехаться
        // по чанкам (primevue/form/vendor) и дать несогласованные vnode —
        // тот же `insertBefore of null` в проде.
        dedupe: ['vue'],
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
            // TS-маппинг `ziggy-js -> vendor/tightenco/ziggy` из tsconfig/jsconfig
            // Vite не читает, поэтому дублируем здесь, иначе
            // `import ... from "ziggy-js"` падает с Failed to resolve import.
            'ziggy-js': path.resolve(__dirname, 'vendor/tightenco/ziggy'),
        },
    },
    build: {
        chunkSizeWarningLimit: 1100,
        reportCompressedSize: false,
        cssCodeSplit: true,
        modulePreload: { polyfill: false },
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // Группируем ТОЛЬКО вендоров: стабильные крупные либы
                    // лежат в своих чанках (прекеш PWA на них опирается).
                    //
                    // Свой код (resources/js) НЕ трогаем специально: Rolldown
                    // сам режет его на мелкие чанки по графу импортов, и это
                    // и есть изоляция модулей — ulove-страница тянет только
                    // dating/api и свайп-хуки, карта — pins/districts/api,
                    // ядро — только общее. Проверено манифестом сборки:
                    // entry тянет ~15 мелких shared-чанков без кода разделов.
                    // (Раньше тут были mod-* правила по подстрокам путей —
                    // они стаскивали общий код в чанки разделов, и entry
                    // грузил чужие модули всем. Больше так не делаем.)
                    //
                    // Правила включения/выключения разделов от этого не
                    // зависят: включение догружает страницу раздела
                    // (useAppModulesSettings.preload -> import Pages/...),
                    // выключение чистит кэши pwa-build/pages/api + reload.
                    if (id.includes('node_modules')) {
                        if (id.includes('maplibre-gl')) return 'maplibre';
                        if (id.includes('primevue') || id.includes('@primeuix')) return 'primevue';
                        if (id.includes('pusher-js') || id.includes('laravel-echo')) return 'realtime';
                        if (id.includes('vee-validate') || id.includes('zod')) return 'form';
                        // Swiper импортируется ТОЛЬКО из async-компонентов
                        // (карусели/вьюверы через defineAsyncComponent), поэтому
                        // живёт в отдельном ленивом чанке, а не в общем vendor.
                        // Если где-то появится статический импорт swiper —
                        // чанк станет eager для всех, следи за билдом.
                        if (id.includes('swiper')) return 'swiper';
                        return 'vendor';
                    }
                },
            },
        },
        rolldownOptions: {
            output: {
                manualChunks(id) {
                    // Группируем ТОЛЬКО вендоров: стабильные крупные либы
                    // лежат в своих чанках (прекеш PWA на них опирается).
                    //
                    // Свой код (resources/js) НЕ трогаем специально: Rolldown
                    // сам режет его на мелкие чанки по графу импортов, и это
                    // и есть изоляция модулей — ulove-страница тянет только
                    // dating/api и свайп-хуки, карта — pins/districts/api,
                    // ядро — только общее. Проверено манифестом сборки:
                    // entry тянет ~15 мелких shared-чанков без кода разделов.
                    // (Раньше тут были mod-* правила по подстрокам путей —
                    // они стаскивали общий код в чанки разделов, и entry
                    // грузил чужие модули всем. Больше так не делаем.)
                    //
                    // Правила включения/выключения разделов от этого не
                    // зависят: включение догружает страницу раздела
                    // (useAppModulesSettings.preload -> import Pages/...),
                    // выключение чистит кэши pwa-build/pages/api + reload.
                    if (id.includes('node_modules')) {
                        if (id.includes('maplibre-gl')) return 'maplibre';
                        if (id.includes('primevue') || id.includes('@primeuix')) return 'primevue';
                        if (id.includes('pusher-js') || id.includes('laravel-echo')) return 'realtime';
                        if (id.includes('vee-validate') || id.includes('zod')) return 'form';
                        // Swiper импортируется ТОЛЬКО из async-компонентов
                        // (карусели/вьюверы через defineAsyncComponent), поэтому
                        // живёт в отдельном ленивом чанке, а не в общем vendor.
                        // Если где-то появится статический импорт swiper —
                        // чанк станет eager для всех, следи за билдом.
                        if (id.includes('swiper')) return 'swiper';
                        return 'vendor';
                    }
                },
            },
        },
    },
    worker: {
        format: 'es',
    },
    plugins: [
        laravel({
            input: 'resources/js/app.ts',
            ssr: 'resources/js/ssr.ts',
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
        VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            strategies: 'generateSW',
            manifestFilename: 'manifest.webmanifest',
            includeAssets: ['offline.html', 'push-sw.js', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-512x512.png', 'apple-touch-icon.png', 'pwa-icon.svg', 'favicon.ico'],
            // PWA-манифест UPin: имя, тёмный тёплый сплэш (#150B10 —
            // в цвет boot-экрана app.blade.php для бесшовного старта),
            // комбинированная иконка пин+сердце, шорткаты разделов.
            // Файл public/manifest.webmanifest при сборке генерится
            // отсюда же — руками его не правим.
            manifest: {
                name: 'UPin',
                short_name: 'UPin',
                id: '/?source=pwa',
                description: 'UPin — живая карта и знакомства ULove рядом: пины, чаты, события и встречи.',
                start_url: '/?source=pwa',
                scope: '/',
                display: 'standalone',
                orientation: 'any',
                background_color: '#150B10',
                theme_color: '#150B10',
                lang: 'ru-RU',
                dir: 'ltr',
                categories: ['social', 'navigation', 'lifestyle'],
                icons: [
                    { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                    { src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                ],
                shortcuts: [
                    {
                        name: 'ULove — свайпы',
                        short_name: 'ULove',
                        description: 'Знакомства рядом: свайпы, мэтч открывает чат',
                        url: '/swipes?source=pwa-shortcut',
                        icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
                    },
                    {
                        name: 'Карта встреч',
                        short_name: 'Карта',
                        description: 'Пины рядом: позови на встречу в 2 клика',
                        url: '/map?source=pwa-shortcut',
                        icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
                    },
                    {
                        name: 'Чаты',
                        short_name: 'Чаты',
                        description: 'Сообщения и мэтчи',
                        url: '/chat?source=pwa-shortcut',
                        icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
                    },
                ],
            },
            workbox: {
                // Прекеш — ТОЛЬКО шелл (первый визит по 3G): entry + общие
                // вендоры + офлайн. Раньше тут было `**/*.{js,css,html,woff2}` —
                // SW на первом визите качал ВЕСЬ билд (~130 чанков, ~2.5МБ:
                // все страницы, диалоги, maplibre), забивал канал и ронял
                // LCP/TTI. Ленивые чанки — через runtime-кэш `/build/` ниже.
                globPatterns: [
                    'assets/app-*.{js,css}',
                    'assets/vendor-*.js',
                    'assets/primevue-*.js',
                    'assets/form-*.js',
                    'assets/realtime-*.js',
                    'assets/rolldown-runtime-*.js',
                    'assets/api-*.js',
                    'offline.html',
                ],
                manifestTransforms: [
                    (entries) => {
                        const normalized = entries.map((entry) => {
                            const isRootManifest = entry.url === 'manifest.webmanifest';
                            const normalizedUrl = isRootManifest
                                ? '/manifest.webmanifest'
                                : entry.url.startsWith('/')
                                    ? entry.url
                                    : `/build/${entry.url}`;
                            return { ...entry, url: normalizedUrl };
                        });
                        const seenUrls = new Set();
                        const deduped = normalized.filter((entry) => {
                            const alreadySeen = seenUrls.has(entry.url);
                            seenUrls.add(entry.url);
                            return !alreadySeen;
                        });
                        for (const f of ['offline.html', 'pwa-192x192.png', 'pwa-512x512.png', 'maskable-512x512.png', 'apple-touch-icon.png', 'pwa-icon.svg', 'favicon.ico']) {
                            const alreadyListed = deduped.some((m) => m.url === `/${f}`);
                            if (alreadyListed) continue;
                            const revision = fileRevision(f);
                            if (revision) deduped.push({ url: `/${f}`, revision });
                        }
                        return { manifest: deduped, warnings: [] };
                    },
                ],
                navigateFallback: null,
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                importScripts: ['/push-sw.js'],
                runtimeCaching: [
                    {
                        urlPattern: ({ request, url }) =>
                            request.mode === 'navigate' &&
                            !url.pathname.startsWith('/api/') &&
                            !url.pathname.startsWith('/broadcasting/') &&
                            !url.pathname.startsWith('/reverb/') &&
                            !url.pathname.startsWith('/admin'),
                        handler: 'NetworkFirst',
                        method: 'GET',
                        options: {
                            cacheName: 'pwa-pages',
                            networkTimeoutSeconds: 3,
                            expiration: { maxEntries: 20, maxAgeSeconds: 86400 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.(bunny|googleapis|gstatic)\.net\/.*/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'pwa-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } },
                    },
                    {
                        urlPattern: /^https:\/\/.*(tile|tiles|basemap|cartodb|openstreetmap|maptiler|stadia|demotiles).*$/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'pwa-map-tiles', expiration: { maxEntries: 300, maxAgeSeconds: 2592000 }, cacheableResponse: { statuses: [0, 200] } },
                    },
                    {
                        urlPattern: ({ request }) => request.destination === 'image',
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'pwa-images', expiration: { maxEntries: 150, maxAgeSeconds: 604800 }, cacheableResponse: { statuses: [0, 200] } },
                    },
                    {
                        // Хэшированные чанки Vite иммутабельны: повторный визит —
                        // мгновенно из кэша, без похода в сеть. Ленивые страницы
                        // и диалоги подхватываются по требованию, а не прекешем.
                        urlPattern: ({ url }) => url.pathname.startsWith('/build/'),
                        handler: 'CacheFirst',
                        options: { cacheName: 'pwa-build', expiration: { maxEntries: 150, maxAgeSeconds: 2592000 }, cacheableResponse: { statuses: [0, 200] } },
                    },
                    {
                        urlPattern: ({ url }) => url.pathname.startsWith('/api/pins') || url.pathname.startsWith('/api/conversations'),
                        handler: 'NetworkFirst',
                        method: 'GET',
                        options: { cacheName: 'pwa-api', networkTimeoutSeconds: 4, expiration: { maxEntries: 50, maxAgeSeconds: 300 }, cacheableResponse: { statuses: [0, 200] } },
                    },
                    {
                        urlPattern: ({ url }) => url.pathname.startsWith('/api/') && url.pathname !== '/api/version',
                        handler: 'NetworkFirst',
                        method: 'GET',
                        options: { cacheName: 'pwa-api', networkTimeoutSeconds: 3, expiration: { maxEntries: 100, maxAgeSeconds: 120 }, cacheableResponse: { statuses: [0, 200] } },
                    },
                ],
            },
            devOptions: { enabled: false },
        }),
        compression({ include: /\.(js|css|html|svg|json)$/, threshold: 10240, deleteOriginalAssets: false }),
        compression({ include: /\.(js|css|html|svg|json)$/, threshold: 10240, deleteOriginalAssets: false, algorithm: 'brotliCompress' }),
    ],
});
