import { PushNotifications } from '@capacitor/push-notifications';
import { ref } from 'vue';
import { usePlatform } from '@/composables/usePlatform';
import { mobileApi } from '@/services/mobile.api';

const fcmToken = ref<string | null>(null);
const permissionGranted = ref(false);
const pushUnavailable = ref(false);
let listenersBound = false;

/**
 * Нативные пуши (FCM) для Capacitor.
 *
 * Web Push (push-sw.js + usePush) не трогаем — этот хук только для iOS/Android.
 * Токен сохраняет в /api/device-tokens, входящие в foreground отдаем
 * штатному тосту через CustomEvent (слушает useAppNotifications).
 *
 * Безопасен для релизных сборок без Firebase (нет google-services.json):
 * register() в таком случае кидает нативный эксепшн и роняет приложение,
 * поэтому всё обёрнуто в try/catch, а отсутствие FCM фиксируется
 * флагом pushUnavailable вместо краша.
 *
 * @returns init(), токен, флаг разрешения и флаг недоступности FCM
 * @example
 * const { initNativePush } = useNativePush()
 * await initNativePush()
 */
export function useNativePush() {
    const { isNative, platform } = usePlatform();

    async function initNativePush(): Promise<void> {
        if (!isNative) {
            return;
        }
        try {
            bindListenersOnce(platform);
            const current = await PushNotifications.checkPermissions();
            const alreadyGranted = current.receive === 'granted';
            const received = alreadyGranted ? current : await PushNotifications.requestPermissions();
            const granted = received.receive === 'granted';
            permissionGranted.value = granted;
            if (!granted) {
                return;
            }
            await PushNotifications.register();
        } catch {
            pushUnavailable.value = true;
        }
    }

    /**
     * Подписывает нативные слушатели пушей (один раз, до register()).
     *
     * @param nativePlatform платформа из usePlatform()
     */
    function bindListenersOnce(nativePlatform: string): void {
        if (listenersBound) {
            return;
        }
        listenersBound = true;
        PushNotifications.addListener('registration', async ({ value }) => {
            fcmToken.value = value;
            const target = nativePlatform === 'ios' ? 'ios' : 'android';
            try {
                await mobileApi.saveDeviceToken(target, value);
            } catch {}
        });
        PushNotifications.addListener('registrationError', () => {
            pushUnavailable.value = true;
        });
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            window.dispatchEvent(new CustomEvent('upin:native-push', { detail: notification }));
        });
        PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
            const url = (notification.data as Record<string, string> | undefined)?.url;
            if (url) {
                window.location.href = url;
            }
        });
    }

    return { fcmToken, permissionGranted, pushUnavailable, initNativePush };
}
