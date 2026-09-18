import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'

const NATIVE_COOKIE = 'upin_client=native; path=/; max-age=31536000; SameSite=Lax'

const detectedNative = ref(false)
const detectedPlatform = ref<string | null>(null)
let initialized = false

declare global {
  interface Window {
    UPinApp?: { expoPushToken?: string | null; pushPermission?: string; platform?: string }
    UPin?: { expoPushToken?: string | null; platform?: string }
    expoPushToken?: string | null
    ReactNativeWebView?: { postMessage: (message: string) => void }
  }
}

/**
 * Прочитать платформу, которую прокинула нативная оболочка.
 *
 * @returns нормализованное имя платформы или null в браузере
 */
function readInjectedPlatform(): string | null {
  const injected = window.UPinApp?.platform ?? window.UPin?.platform ?? null
  if (typeof injected !== 'string') {
    return null
  }

  const platform = injected.trim().toLowerCase()
  if (platform === '') {
    return null
  }

  return platform
}

/**
 * Определить платформу по user-agent как запасной вариант.
 *
 * @returns android/ios или null
 */
function readPlatformFromUserAgent(): string | null {
  const userAgent = navigator.userAgent.toLowerCase()
  const isIos = userAgent.includes('iphone') || userAgent.includes('ipad')
  if (isIos) {
    return 'ios'
  }

  const isAndroid = userAgent.includes('android')
  if (isAndroid) {
    return 'android'
  }

  return null
}

/**
 * Проверить явные маркеры upin-mobile: JS-мост, инжект или UA-суффикс.
 *
 * Общий `; wv)` не считаем признаком — так помечаются
 * и браузерные кастомные вкладки.
 *
 * @returns true внутри нативной WebView
 */
export function isNativeWebView(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const hasBridge = Boolean(window.ReactNativeWebView)
  if (hasBridge) {
    return true
  }

  const hasInject = Boolean(window.UPinApp ?? window.UPin)
  if (hasInject) {
    return true
  }

  const userAgent = navigator.userAgent.toLowerCase()
  return userAgent.includes('upinmobile') || userAgent.includes('upin-android') || userAgent.includes('upin-ios') || userAgent.includes('upinapp')
}

/**
 * Значение заголовка X-UPin-Client для текущего клиента.
 *
 * @returns android-webview/ios-webview/native/web
 */
export function nativeClientHeader(): string {
  if (!isNativeWebView()) {
    return 'web'
  }

  const platform = readInjectedPlatform() ?? readPlatformFromUserAgent()
  if (platform?.includes('ios')) {
    return 'ios-webview'
  }

  if (platform?.includes('android')) {
    return 'android-webview'
  }

  return 'native'
}

/**
 * Сообщить оболочке, что web-слой загрузился и готов гасить сплэш.
 */
function notifyShellReady(): void {
  try {
    const payload = JSON.stringify({ type: 'upin-ready' })
    window.ReactNativeWebView?.postMessage(payload)
  } catch {
    // No-op: оболочка может отсутствовать в браузере.
  }
}

/**
 * Закрепить признак натива для следующих запросов без контекста Vue.
 *
 * Ставит куку `upin_client=native`, если открыты в WebView.
 * Безопасна для вызова из boot-файлов (app.ts) до монтирования.
 *
 * @returns true если признак закреплен
 */
export function persistNativeMarker(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  const native = isNativeWebView()
  if (!native) {
    return false
  }

  document.cookie = NATIVE_COOKIE
  notifyShellReady()

  return true
}

/**
 * Работа с признаком нативного клиента (upin-mobile WebView).
 *
 * Инициализация ставит куку `upin_client=native`, чтобы уже
 * вторая навигация точно bypass'ила SSR на бэке, даже если
 * оболочка не умеет слать кастомный header на document-запросе.
 * Первый визит гарантирует сама мобилка: header `X-UPin-Client`
 * или UA-суффикс `UPinMobile/` в настройках WebView.
 *
 * @example
 * ```ts
 * const { isNative, initNativeClient } = useNativeClient()
 * await initNativeClient()
 * if (isNative.value) { ... }
 * ```
 *
 * @returns состояние клиента и инициализатор
 */
export function useNativeClient() {
  const page = usePage()

  const serverFlag = computed(() => {
    const client = (page.props as unknown as { client?: { isNative?: boolean } }).client
    return client?.isNative ?? null
  })

  const isNative = computed(() => {
    if (serverFlag.value !== null) {
      return serverFlag.value
    }

    return detectedNative.value
  })

  const platform = computed(() => detectedPlatform.value)

  async function initNativeClient(): Promise<void> {
    if (initialized) {
      return
    }
    initialized = true

    const native = isNativeWebView()
    detectedNative.value = native
    if (!native) {
      return
    }

    const resolvedPlatform = readInjectedPlatform() ?? readPlatformFromUserAgent()
    detectedPlatform.value = resolvedPlatform

    document.cookie = NATIVE_COOKIE

    notifyShellReady()
  }

  return { isNative, platform, serverFlag, initNativeClient }
}
