import { computed, ref } from 'vue'
import type { TelegramWebApp, TelegramWebAppUser } from '@/types/telegram'

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js'
const TG_COOKIE = 'upin_client=telegram; path=/; max-age=31536000; SameSite=Lax'

const isTelegram = ref(false)
const isReady = ref(false)
const initData = ref('')
const telegramUser = ref<TelegramWebAppUser | null>(null)
const colorScheme = ref<'light' | 'dark'>('light')
const viewportHeight = ref(0)
const platform = ref('')
const startParam = ref('')

let initialized = false
let scriptPromise: Promise<boolean> | null = null

/**
 * Достать WebApp-объект, если скрипт уже загружен.
 *
 * @returns WebApp или null вне Telegram
 */
function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') {
    return null
  }

  const webApp = window.Telegram?.WebApp ?? null

  if (!webApp || typeof webApp.ready !== 'function') {
    return null
  }

  return webApp
}

/**
 * Проверить маркеры Telegram до загрузки скрипта (query от Bot API).
 *
 * @returns true когда URL содержит tgWebApp-параметры
 */
function hasTelegramQuery(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const search = window.location.search.toLowerCase()

  return search.includes('tgwebappplatform') || search.includes('tgwebappdata') || search.includes('tgwebappversion')
}

/**
 * Загрузить telegram-web-app.js один раз на приложение.
 *
 * @returns true когда скрипт загружен
 */
async function loadScript(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  if (window.Telegram?.WebApp) {
    return true
  }

  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`)

    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.addEventListener('load', () => resolve(true), { once: true })
    script.addEventListener('error', () => resolve(false), { once: true })
    document.head.appendChild(script)
  })

  return scriptPromise
}

/**
 * Применить viewport и тему из WebApp в CSS-переменные документа.
 *
 * @param webApp живой объект Telegram WebApp
 */
function applyViewport(webApp: TelegramWebApp): void {
  viewportHeight.value = webApp.viewportHeight || window.innerHeight
  colorScheme.value = webApp.colorScheme === 'dark' ? 'dark' : 'light'
  platform.value = webApp.platform || ''
  startParam.value = webApp.initDataUnsafe?.start_param || ''

  const root = document.documentElement
  root.style.setProperty('--tg-viewport-height', `${viewportHeight.value}px`)
  root.style.setProperty('--tg-viewport-stable', `${webApp.viewportStableHeight || viewportHeight.value}px`)
  root.classList.toggle('tg-dark', colorScheme.value === 'dark')
  root.dataset.tgPlatform = platform.value
}

/**
 * Покрасить шапку и фон Mini App под текущую тему сайта.
 *
 * @param isDark true — тёмная тема сайта
 */
function syncChrome(isDark: boolean): void {
  const webApp = getWebApp()

  if (!webApp) {
    return
  }

  try {
    const header = isDark ? '#150B10' : '#ffffff'
    const bg = isDark ? '#150B10' : '#ffffff'
    webApp.setHeaderColor(header)
    webApp.setBackgroundColor(bg)
  } catch {
    // No-op: старые клиенты без setHeaderColor.
  }
}

/**
 * Мост к Telegram Mini App (@U1ove_bot через WebView).
 *
 * Отвечает только за детект, ready/expand, viewport, тему и хаптику.
 * Авторизация — в `useTelegramAuth`, кнопка «назад» — в
 * `useTelegramNavigation` (Правило №1: один хук — одна ответственность).
 *
 * @example
 * ```ts
 * const { isTelegram, telegramUser, initTelegram } = useTelegram()
 * await initTelegram()
 * if (isTelegram.value) { ... }
 * ```
 *
 * @returns состояние моста и методы WebApp
 */
export function useTelegram() {
  const displayUserName = computed(() => {
    const user = telegramUser.value

    if (!user) {
      return ''
    }

    const full = `${user.first_name || ''} ${user.last_name || ''}`.trim()

    return full || user.username || ''
  })

  /**
   * Инициализировать мост: загрузить скрипт, ready + expand.
   *
   * Идемпотентен: повторные вызовы возвращают закэшированный результат.
   * Вне Telegram возвращает false без ошибок.
   *
   * @returns true внутри Telegram Mini App
   */
  async function initTelegram(): Promise<boolean> {
    if (initialized) {
      return isTelegram.value
    }
    initialized = true

    if (typeof window === 'undefined') {
      return false
    }

    const inTelegram = getWebApp() !== null || hasTelegramQuery()

    if (!inTelegram) {
      return false
    }

    const loaded = await loadScript()
    const webApp = getWebApp()

    if (!loaded || !webApp) {
      return false
    }

    try {
      webApp.ready()
      webApp.expand()
    } catch {
      // No-op: ready/expand не критичны для рендера.
    }

    isTelegram.value = true
    isReady.value = true
    initData.value = webApp.initData || ''
    telegramUser.value = webApp.initDataUnsafe?.user ?? null

    try {
      document.cookie = TG_COOKIE
    } catch {
      // No-op: кука необязательна, бэк детектит и по заголовку.
    }

    applyViewport(webApp)

    try {
      webApp.onEvent('viewportChanged', () => applyViewport(webApp))
      webApp.onEvent('themeChanged', () => applyViewport(webApp))
    } catch {
      // No-op: подписки на события необязательны.
    }

    return true
  }

  /**
   * Значение заголовка X-UPin-Client для Telegram-клиента.
   *
   * @returns telegram-webapp внутри TG, иначе null (пусть решает useNativeClient)
   */
  function telegramClientHeader(): string | null {
    if (isTelegram.value || getWebApp() !== null || hasTelegramQuery()) {
      return 'telegram-webapp'
    }

    return null
  }

  /**
   * Закрепить telegram-маркер для document-запросов без контекста Vue.
   *
   * Безопасен для вызова из boot до монтирования.
   *
   * @returns true если маркер закреплён
   */
  function persistTelegramMarker(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false
    }

    const inTelegram = getWebApp() !== null || hasTelegramQuery()

    if (!inTelegram) {
      return false
    }

    isTelegram.value = true

    try {
      document.cookie = TG_COOKIE
    } catch {
      // No-op.
    }

    return true
  }

  /**
   * Лёгкий хаптик (тап по карточке, свайп).
   */
  function hapticLight(): void {
    try {
      getWebApp()?.HapticFeedback?.impactOccurred('light')
    } catch {
      // No-op.
    }
  }

  /**
   * Средний хаптик (матч, важное действие).
   */
  function hapticMedium(): void {
    try {
      getWebApp()?.HapticFeedback?.impactOccurred('medium')
    } catch {
      // No-op.
    }
  }

  /**
   * Хаптик результата (успех/ошибка отправки).
   *
   * @param type тип уведомления телеграма
   */
  function hapticNotify(type: 'error' | 'success' | 'warning'): void {
    try {
      getWebApp()?.HapticFeedback?.notificationOccurred(type)
    } catch {
      // No-op.
    }
  }

  /**
   * Открыть ссылку: внутри TG — через WebApp, снаружи — новая вкладка.
   *
   * @param url абсолютный url
   */
  function openLink(url: string): void {
    const webApp = getWebApp()

    if (webApp) {
      try {
        webApp.openLink(url)
        return
      } catch {
        // Fallback ниже.
      }
    }

    window.open(url, '_blank', 'noopener')
  }

  /**
   * Закрыть Mini App (кнопка «выйти в Telegram»).
   */
  function closeMiniApp(): void {
    try {
      getWebApp()?.close()
    } catch {
      // No-op.
    }
  }

  return {
    isTelegram,
    isReady,
    initData,
    telegramUser,
    displayUserName,
    colorScheme,
    viewportHeight,
    platform,
    startParam,
    initTelegram,
    telegramClientHeader,
    persistTelegramMarker,
    syncChrome,
    hapticLight,
    hapticMedium,
    hapticNotify,
    openLink,
    closeMiniApp,
  }
}

/**
 * Проверить, что страница открыта внутри Telegram (без инициализации).
 *
 * Для axios-интерцептора, где нельзя ждать initTelegram.
 *
 * @returns true при наличии WebApp или tgWebApp-query
 */
export function isTelegramWebView(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return getWebApp() !== null || hasTelegramQuery()
}
