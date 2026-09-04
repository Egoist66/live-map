import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
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
    resolve: { alias: { '@': path.resolve(__dirname, 'resources/js') } },
    build: {
        chunkSizeWarningLimit: 1100,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('maplibre-gl')) return 'maplibre';
                        if (id.includes('primevue') || id.includes('@primeuix')) return 'primevue';
                        if (id.includes('pusher-js') || id.includes('laravel-echo')) return 'realtime';
                        if (id.includes('vee-validate') || id.includes('zod')) return 'form';
                        return 'vendor';
                    }
                },
            },
        },
        rolldownOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('maplibre-gl')) return 'maplibre';
                        if (id.includes('primevue') || id.includes('@primeuix')) return 'primevue';
                        if (id.includes('pusher-js') || id.includes('laravel-echo')) return 'realtime';
                        if (id.includes('vee-validate') || id.includes('zod')) return 'form';
                        return 'vendor';
                    }
                },
            },
        },
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
            manifest: {
                name: 'UPin — Живая карта района',
                short_name: 'UPin',
                description: 'Гиперлокальная карта района: пины соседей рядом, чаты, события и помощь.',
                start_url: '/?source=pwa',
                scope: '/',
                display: 'standalone',
                orientation: 'any',
                background_color: '#0F172A',
                theme_color: '#0F172A',
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
                    { name: 'Карта рядом', url: '/map?source=pwa-shortcut', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
                    { name: 'Чаты', url: '/chat?source=pwa-shortcut', icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }] },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,woff2}'],
                manifestTransforms: [
                    (entries) => {
                        const manifest = entries.map((e) => ({
                            ...e,
                            url: e.url.startsWith('/') ? e.url : `/build/${e.url}`,
                        }));
                        for (const f of ['offline.html', 'manifest.webmanifest', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-icon.svg', 'favicon.ico']) {
                            if (!manifest.some((m) => m.url === `/${f}`)) {
                                const revision = fileRevision(f);
                                if (revision) manifest.push({ url: `/${f}`, revision });
                            }
                        }
                        return { manifest, warnings: [] };
                    },
                ],
                navigateFallback: '/offline.html',
                navigateFallbackDenylist: [/^\/api\//, /^\/broadcasting\//, /^\/reverb\//, /\/admin/],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: false,
                importScripts: ['/push-sw.js'],
                runtimeCaching: [
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
                        urlPattern: ({ url }) => url.pathname.startsWith('/api/pins') || url.pathname.startsWith('/api/conversations'),
                        handler: 'NetworkFirst',
                        method: 'GET',
                        options: { cacheName: 'pwa-api', networkTimeoutSeconds: 4, expiration: { maxEntries: 50, maxAgeSeconds: 300 }, cacheableResponse: { statuses: [0, 200] } },
                    },
                ],
            },
            devOptions: { enabled: false },
        }),
    ],
});
