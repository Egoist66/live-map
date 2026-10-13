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

/**
 * Разложить node_modules по стабильным вендор-чанкам.
 *
 * Группируем ТОЛЬКО вендоров: стабильные крупные либы лежат в своих
 * чанках (прекеш PWA на них опирается).
 *
 * Свой код (resources/js) НЕ трогаем специально: Rolldown сам режет его
 * на мелкие чанки по графу импортов, и это и есть изоляция модулей —
 * ulove-страница тянет только dating/api и свайп-хуки, карта —
 * pins/districts/api, ядро — только общее.
 *
 * (Раньше тут были mod-* правила по подстрокам путей — они стаскивали
 * общий код в чанки разделов, и entry грузил чужие модули всем.
 * Больше так не делаем.)
 *
 * @param id путь модуля
 * @returns имя чанка или undefined (дефолтная нарезка Rolldown)
 */
function vendorChunk(id) {
    if (!id.includes('node_modules')) {
        return undefined;
    }

    if (id.includes('maplibre-gl')) return 'maplibre';
    // PrimeVue НЕ группируем в один чанк сознательно: монолит
    // `primevue-*.js` весил 1.1МБ raw (233КБ gzip) и прелоадился целиком
    // даже на лендинге, где нужны Button/Card/Tag/Badge/Avatar
    // (Lighthouse: «неиспользуемый JS» 292КБ, TBT от парсинга).
    // `undefined` отдаёт нарезку Rolldown: страница тянет только свои
    // компоненты + общие internals отдельными shared-чанками.
    // PWA-безопасно: ленивые чанки покрыты runtime-кэшем `pwa-build`
    // (CacheFirst), прекеш их не ждёт.
    if (id.includes('primevue') || id.includes('@primeuix') || id.includes('@primevue')) {
        return undefined;
    }
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

/**
 * Dev-страница и Vite живут на разных ориджинах (app-dev :8001,
 * Vite :5173), а `<script type="module">` требует CORS. Без явного
 * `server.cors` Vite 8 пинит `Access-Control-Allow-Origin` в значение
 * `server.origin` (:5173) — и браузер режет `@vite/client`/`app.ts`.
 * Разрешаем только локальное: loopback на любом порту + приватная
 * LAN (тест с телефона через http://192.168.x.x:8001).
 */
const devCorsOrigins = [
    /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/,
    /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/,
];

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
        // Herd/Valet-автоопределение laravel-vite-plugin молча включает
        // HTTPS (сертификат live-map.test) — тогда сервер говорит по TLS,
        // а в public/hot пишется http://localhost:5173 из origin выше.
        // Браузер ходит по http на TLS-порт и получает ERR_EMPTY_RESPONSE
        // (curl: Empty reply from server). Фиксируем plain HTTP для
        // `pnpm dev` + artisan serve. Кому нужен Herd-https — убрать строку
        // и зайти через https://live-map.test.
        https: false,
        // CORS под страницу :8001 — см. devCorsOrigins выше.
        cors: {
            origin: devCorsOrigins,
        },
        hmr: {
            host: 'localhost',
            port: 5173,
        },
        watch: {
            usePolling: process.env.VITE_WATCH_POLL === 'true',
            interval: 500,
            // Polling гоняет stat по всему дереву каждые interval мс:
            // выкидываем тяжёлые нетронутые папки, чтобы HMR замечал
            // правки resources/js за миллисекунды, а не пережевывал
            // vendor/node_modules/storage. Без этого на Windows
            // bind-mount HMR лагал и жег CPU.
            ignored: [
                '**/node_modules/**',
                '**/vendor/**',
                '**/storage/**',
                '**/bootstrap/ssr/**',
                '**/public/build/**',
                '**/.git/**',
            ],
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
                // Логика нарезки — в `vendorChunk()` выше (единая для
                // rollup/rolldown, чтобы чанки не разъезжались).
                manualChunks: vendorChunk,
            },
        },
        rolldownOptions: {
            output: {
                // Логика нарезки — в `vendorChunk()` выше (единая для
                // rollup/rolldown, чтобы чанки не разъезжались).
                manualChunks: vendorChunk,
            },
        },
    },
    worker: {
        format: 'es',
    },
    ssr: {
        // Самодостаточный SSR-бандл: все npm-зависимости инлайнятся
        // в bootstrap/ssr/ssr.js. Иначе бандл дергает bare-импорты
        // (vue, @inertiajs/...) из node_modules, которых нет в прод-образе
        // (мультистейдж не везёт node_modules) — SSR падает
        // с ERR_MODULE_NOT_FOUND. На клиентский билд не влияет.
        noExternal: true,
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
                description: 'ULove — знакомства рядом: свайпы, мэтчи и чат.',
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
                // Прекеш — ТОЛЬКО шелл (первый визит по 3G): entry + общий
                // vendor + офлайн. Раньше тут было `**/*.{js,css,html,woff2}` —
                // SW на первом визите качал ВЕСЬ билд (~130 чанков, ~2.5МБ:
                // все страницы, диалоги, maplibre), забивал канал и ронял
                // LCP/TTI. Ленивые чанки — через runtime-кэш `/build/` ниже.
                //
                // primevue/form/realtime/maplibre/swiper в прекеше НЕТ
                // сознательно: primevue едет вместе с entry через modulepreload
                // (двойная закачка в install только душила бы канал), а form
                // (vee-validate+zod ~150КБ), realtime (echo+pusher) и maplibre
                // нужны не всем (гости/не-карта) — их первый визит не должен
                // оплачивать. Догрузка — CacheFirst `pwa-build` ниже, повторный
                // визит идёт из кэша без сети. Сжатие на проде (Laravel Cloud)
                // делает edge (Cloudflare): .gz/.br рядом с чанками для него
                // не нужны, service worker кэширует уже распакованные ответы.
                globPatterns: [
                    'assets/app-*.{js,css}',
                    'assets/vendor-*.js',
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
                // navigateFallback ОТКЛЮЧЁН (null, а не строка): Workbox
                // регистрирует его NavigationRoute ПЕРЕД runtimeCaching
                // (см. sw-template.ts), а createHandlerBoundToURL подменяет
                // ЛЮБУЮ навигацию precached-ответом БЕЗ похода в сеть.
                // Итог прошлого значения '/offline.html': все клиенты
                // с установленным SW видели «Вы оффлайн» при живом
                // интернете (лечилось только жёсткой перезагрузкой
                // в обход SW). Дефолт vite-plugin-pwa — 'index.html',
                // его тоже гасим: такого файла в прекеше нет, SW падал
                // бы с non-precached-url. Навигации обслуживает
                // NetworkFirst `pwa-pages` ниже: онлайн — свежий HTML,
                // офлайн — закэшированная страница. offline.html остаётся
                // в прекеше для пробы isOfflineReady(), но навигации
                // больше не перехватывает.
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
                        // Навигация уходит в офлайн-фолбэк только после этого
                        // таймаута: 3с роняли страницу при холодном воркере
                        // после деплоя и на медленной мобильной сети, хотя
                        // интернет был. 10с — компромисс: живой, но
                        // притормаживающий сервер ждём, мёртвый — не вешаем.
                        options: {
                            cacheName: 'pwa-pages',
                            networkTimeoutSeconds: 10,
                            // Час, а не сутки: закэшированный HTML ссылается
                            // на хэшированные чанки конкретного билда — после
                            // деплоя старые чанки удалены и страница из кэша
                            // грузит entry в 404 (белый экран до ручной
                            // перезагрузки). Час держит офлайн-читалку живой,
                            // но не даёт протухнуть на целый день.
                            expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
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
