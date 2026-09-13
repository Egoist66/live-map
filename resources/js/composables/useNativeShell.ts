import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { usePlatform } from '@/composables/usePlatform';

let initialized = false;

/**
 * Нативная оболочка: статус-бар, сплэш, кнопка назад, вибрация.
 *
 * На вебе — no-op. Вызывать один раз из layout (AuthenticatedLayout).
 *
 * @returns init() и impact()
 * @example
 * const { initNativeShell } = useNativeShell()
 * await initNativeShell()
 */
export function useNativeShell() {
    const { isNative, isAndroid } = usePlatform();

    async function initNativeShell(): Promise<void> {
        if (!isNative || initialized) {
            return;
        }
        initialized = true;
        try {
            await StatusBar.setOverlaysWebView({ overlay: false });
        } catch {}
        try {
            await StatusBar.setStyle({ style: Style.Dark });
        } catch {}
        try {
            await StatusBar.setBackgroundColor({ color: '#0F172A' });
        } catch {}
        if (isAndroid) {
            try {
                await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
            } catch {}
        }
        applySafeAreaFallback();
        try {
            await SplashScreen.hide();
        } catch {}
        if (isAndroid) {
            App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) {
                    window.history.back();
                } else {
                    void App.exitApp();
                }
            });
        }
    }

    /**
     * Замер реального `safe-area-inset-top` в WebView.
     *
     * На части прошивок WebView отдаёт `env()` нулём даже под шторкой —
     * тогда помечаем `<html>` классом `no-safe-area-top`, и CSS
     * подставит фиксированный отступ под статус-бар.
     *
     * @returns void
     */
    function applySafeAreaFallback(): void {
        document.documentElement.classList.add('capacitor-native');
        if (!isAndroid) {
            return;
        }
        document.documentElement.classList.add('capacitor-android');
        const measured = measureSafeAreaTop();
        if (measured < 8) {
            document.documentElement.classList.add('no-safe-area-top');
        }
    }

    /**
     * Считывает раскрытое значение `env(safe-area-inset-top)` через пробный узел.
     *
     * @returns высота инсета в пикселях, 0 если недоступен
     */
    function measureSafeAreaTop(): number {
        const probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.position = 'fixed';
        probe.style.top = '0';
        probe.style.left = '0';
        probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        document.body.appendChild(probe);
        const raw = getComputedStyle(probe).paddingTop;
        probe.remove();
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    async function impact(): Promise<void> {
        if (!isNative) {
            return;
        }
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch {}
    }

    return { initNativeShell, impact };
}
