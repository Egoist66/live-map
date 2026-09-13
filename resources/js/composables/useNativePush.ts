import { PushNotifications } from '@capacitor/push-notifications';
import { ref } from 'vue';
import { usePlatform } from '@/composables/usePlatform';
import { mobileApi } from '@/services/mobile.api';

const fcmToken = ref<string | null>(null);
const permissionGranted = ref(false);
let listenersBound = false;

/**
 * Нативные пуши (FCM) для Capacitor.
 *
 * Web Push (push-sw.js + usePush) не трогаем — этот хук только для iOS/Android.
 * Токен сохраняет в /api/device-tokens, входящие в foreground отдаем
 * штатному тосту через CustomEvent (слушает useAppNotifications).
 *
 * @returns init(), токен и флаг разрешения
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
        const permission = await PushNotifications.requestPermissions();
        const granted = permission.receive === 'granted';
        permissionGranted.value = granted;
        if (!granted) {
            return;
        }
        await PushNotifications.register();
        if (listenersBound) {
            return;
        }
        listenersBound = true;
        PushNotifications.addListener('registration', async ({ value }) => {
            fcmToken.value = value;
            const nativePlatform = platform === 'ios' ? 'ios' : 'android';
            try {
                await mobileApi.saveDeviceToken(nativePlatform, value);
            } catch {}
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

    return { fcmToken, permissionGranted, initNativePush };
}
