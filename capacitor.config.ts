import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor-конфиг UPin.
 *
 * Режим server.url: WebView грузит прод-домен Laravel Cloud напрямую.
 * Отдельный SPA-билд не нужен, web-сборка (laravel-vite-plugin) не меняется.
 * URL подставляется из env при синке, чтобы staging/prod не разъезжались.
 */
const serverUrl = process.env.CAP_SERVER_URL || 'https://upin.laravel.cloud';

const hosts = (() => {
    try {
        return [new URL(serverUrl).hostname];
    } catch {
        return ['upin.laravel.cloud'];
    }
})();

const config: CapacitorConfig = {
    appId: 'com.upin.live',
    appName: 'UPin App',
    webDir: 'dist',
    server: {
        url: serverUrl,
        cleartext: false,
    },
    allowNavigation: hosts,
    android: {
        allowMixedContent: false,
    },
    ios: {
        contentInset: 'always',
    },
    plugins: {
        Keyboard: {
            resizeOnFullScreen: true,
        },
        PushNotifications: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },
        SplashScreen: {
            launchShowDuration: 800,
            backgroundColor: '#0F172A',
        },
    },
};

export default config;
