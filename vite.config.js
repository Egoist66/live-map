import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    ],
});
