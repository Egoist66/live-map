import { Capacitor } from '@capacitor/core';

/**
 * Платформа запуска: web vs натив (Capacitor).
 *
 * Единственное место с `isNativePlatform()` — компоненты обязаны
 * спрашивать платформу только через этот хук (Правило №1).
 *
 * @returns флаги платформы
 * @example
 * const { isNative, isAndroid } = usePlatform()
 * if (isNative) { await registerNativePush() }
 */
export function usePlatform() {
    const platform = Capacitor.getPlatform()
    const isNative = Capacitor.isNativePlatform()
    const isAndroid = platform === 'android'
    const isIos = platform === 'ios'
    const isWeb = !isNative

    return { platform, isNative, isAndroid, isIos, isWeb }
}
