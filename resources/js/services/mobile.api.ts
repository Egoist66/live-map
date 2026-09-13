import { api } from './api';

/**
 * Мобильное API: Sanctum-токены и FCM-регистрация.
 *
 * Web это не использует (там cookie). Только Capacitor-натив.
 */
export const mobileApi = {
    /**
     * Логин натива: обмен email+password на Bearer-токен.
     *
     * @param email email пользователя
     * @param password пароль
     * @param deviceName имя устройства для Sanctum
     * @returns Bearer-токен и краткий профиль
     */
    async createToken(email: string, password: string, deviceName = 'mobile'): Promise<{ token: string }> {
        const payload = { email, password, device_name: deviceName };
        const { data } = await api.post('/api/auth/token', payload);
        return data;
    },

    /**
     * Отозвать текущий токен (logout натива).
     */
    async revokeToken(): Promise<void> {
        await api.delete('/api/auth/token');
    },

    /**
     * Сохранить FCM/APNs токен устройства.
     *
     * @param platform ios|android
     * @param token FCM-токен из PushNotifications
     */
    async saveDeviceToken(platform: 'ios' | 'android', token: string): Promise<void> {
        const payload = { platform, provider: 'fcm', token };
        await api.post('/api/device-tokens', payload);
    },

    /**
     * Удалить токен устройства.
     *
     * @param token FCM-токен
     */
    async removeDeviceToken(token: string): Promise<void> {
        await api.delete('/api/device-tokens', { data: { token } } as never);
    },
};
