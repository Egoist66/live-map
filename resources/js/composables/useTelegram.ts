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
/** Верхний инсет из WebApp API (чёлка в полноэкранном Mini App). */
const tgSafeTop = ref(0)
/** Нижний инсет из WebApp API (жесты/панель в полноэкранном Mini App). */
const tgSafeBottom = ref(0)

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
 * Проверить маркеры Telegram до загрузки скрипта.
 *
 * Telegram при запуске Mini App кладёт стартовые параметры в hash
 * (`#tgWebAppData=...&tgWebAppVersion=...`), а не в query — смотрим оба.
 * На сервер hash не уходит, поэтому бэк детектит только по заголовку/куке,
 * которые ставит уже инициализированный мост.
 *
 * @returns true когда URL содержит tgWebApp-параметры
 */
function hasTelegramQuery(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const haystack = `${window.location.search} ${window.location.hash}`.toLowerCase()

  return haystack.includes('tgwebappplatform') || haystack.includes('tgwebappdata') || haystack.includes('tgwebappversion')
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
 * Проверить, что клиент Telegram поддерживает метод с версии.
 *
 * telegram-web-app.js внутри сам гейтит методы версией, но каждый
 * вызов на старом клиенте (например, 6.0) — это варнинг в консоль
 * («not supported in version 6.0»). Проверяем заранее: сначала
 * родной `isVersionAtLeast` (Bot API 6.2+), на 6.0 его нет —
 * тогда сравниваем `version` вручную.
 *
 * Версии методов: BackButton/setHeaderColor/setBackgroundColor — 6.1,
 * disableVerticalSwipes — 7.1, requestFullscreen/safeArea — 8.0.
 *
 * @param webApp живой объект Telegram WebApp
 * @param required минимальная версия вида '6.1'
 * @returns true когда метод можно вызывать без варнингов
 */
export function webAppSupports(webApp: TelegramWebApp, required: string): boolean {
  try {
    if (typeof webApp.isVersionAtLeast === 'function') {
      return webApp.isVersionAtLeast(required)
    }
  } catch {
    // No-op: упадём в ручное сравнение ниже.
  }

  const parse = (version: string): [number, number] => {
    const parts = String(version || '').split('.')
    const major = Number(parts[0])
    const minor = Number(parts[1])

    return [Number.isFinite(major) ? major : 0, Number.isFinite(minor) ? minor : 0]
  }

  const [major, minor] = parse(webApp.version || '')
  const [reqMajor, reqMinor] = parse(required)

  return major > reqMajor || (major === reqMajor && minor >= reqMinor)
}

/**
 * Перенести палитру Telegram (themeParams) в CSS-переменные документа.
 *
 * Mini App обязан краситься цветами текущей темы Telegram
 * (светлая/тёмная/кастомная), а не хардкодом: клиент присылает
 * bg_color, text_color, button_color и др. Переменные вида
 * `--tg-theme-bg-color` уже выставлены ранним инлайн-скриптом
 * в app.blade.php до paint — здесь обновляем их вживую
 * (событие themeChanged) и добиваем ключи новых Bot API.
 *
 * @param webApp живой объект Telegram WebApp
 */
function applyThemeParams(webApp: TelegramWebApp): void {
  if (typeof document === 'undefined') {
    return
  }

  const theme = webApp.themeParams ?? {}
  const root = document.documentElement

  const entries: Array<[string, string | undefined]> = [
    ['--tg-theme-bg-color', theme.bg_color],
    ['--tg-theme-text-color', theme.text_color],
    ['--tg-theme-hint-color', theme.hint_color],
    ['--tg-theme-link-color', theme.link_color],
    ['--tg-theme-button-color', theme.button_color],
    ['--tg-theme-button-text-color', theme.button_text_color],
    ['--tg-theme-secondary-bg-color', theme.secondary_bg_color],
    ['--tg-theme-header-bg-color', theme.header_bg_color],
    ['--tg-theme-accent-text-color', theme.accent_text_color],
    ['--tg-theme-section-bg-color', theme.section_bg_color],
    ['--tg-theme-section-header-text-color', theme.section_header_text_color],
    ['--tg-theme-subtitle-text-color', theme.subtitle_text_color],
    ['--tg-theme-destructive-text-color', theme.destructive_text_color],
    ['--tg-theme-bottom-bar-bg-color', theme.bottom_bar_bg_color],
  ]

  for (const [name, value] of entries) {
    if (typeof value === 'string' && value !== '') {
      root.style.setProperty(name, value)
    }
  }
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
  root.classList.add('tg-app')
  root.style.setProperty('--tg-viewport-height', `${viewportHeight.value}px`)
  root.style.setProperty('--tg-viewport-stable', `${webApp.viewportStableHeight || viewportHeight.value}px`)
  root.classList.toggle('tg-dark', colorScheme.value === 'dark')
  root.dataset.tgPlatform = platform.value

  applyThemeParams(webApp)
  applyTelegramInsets(webApp)
}

/**
 * Перенести safe-area инсеты Telegram в CSS-переменные и уведомить слушателей.
 *
 * В полноэкранном Mini App браузерный `env(safe-area-inset-*)` — ноль,
 * поэтому без этого шага хедер уезжает под чёлку, а низ — под жесты.
 * Значения кладутся в `--tg-sat/--tg-sab`, итог (`max(env, tg)`)
 * считает единый контроллер `useOverlaySafeArea` по событию `tg:safe-area`.
 *
 * @param webApp живой объект Telegram WebApp
 */
function applyTelegramInsets(webApp: TelegramWebApp): void {
  const inset = webApp.contentSafeAreaInset ?? webApp.safeAreaInset ?? null
  const top = Math.max(0, Math.round(inset?.top ?? 0))
  const bottom = Math.max(0, Math.round(inset?.bottom ?? 0))

  tgSafeTop.value = top
  tgSafeBottom.value = bottom

  try {
    const root = document.documentElement
    root.style.setProperty('--tg-sat', `${top}px`)
    root.style.setProperty('--tg-sab', `${bottom}px`)
    // Живое обновление зазора под нативные кнопки клиента
    // (см. ранний инлайн в app.blade.php): только тач-устройства
    // на мобильных платформах Telegram (android*/ios*) —
    // в десктопном клиенте кнопок поверх WebView нет.
    // Минимум 48px поверх отданного TG инсета.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const tgPlatform = String(webApp.platform || '').toLowerCase()
    const mobileTg = tgPlatform.startsWith('android') || tgPlatform.startsWith('ios')
    const chromeTop = coarse && mobileTg ? Math.max(0, 48 - top) : 0
    root.style.setProperty('--tg-chrome-top', `${chromeTop}px`)
    window.dispatchEvent(new CustomEvent('tg:safe-area', { detail: { top, bottom } }))
  } catch {
    // No-op: без DOM инсеты применит следующий пересчёт safe-area.
  }
}

/**
 * Покрасить шапку и фон Mini App под текущую тему.
 *
 * Берём цвета из палитры Telegram (header_bg_color → bg_color),
 * а не хардкод: в кастомных темах захардкоженный фон выбивается
 * из нативного хрома. Фолбэк — под тему сайта как раньше.
 *
 * @param isDark true — тёмная тема сайта
 */
function syncChrome(isDark: boolean): void {
  const webApp = getWebApp()

  if (!webApp) {
    return
  }

  const theme = webApp.themeParams ?? {}
  const header = theme.header_bg_color || theme.bg_color || (isDark ? '#150B10' : '#ffffff')
  const bg = theme.bg_color || (isDark ? '#150B10' : '#ffffff')

  // setHeaderColor/setBackgroundColor — Bot API 6.1: на 6.0 вызов
  // лишь спамит варнингом в консоль и ничего не делает.
  if (!webAppSupports(webApp, '6.1')) {
    return
  }

  try {
    webApp.setHeaderColor(header)
  } catch {
    // No-op: старые клиенты без setHeaderColor.
  }

  try {
    webApp.setBackgroundColor(bg)
  } catch {
    // No-op: старые клиенты без setBackgroundColor.
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
   * Каждый шаг WebApp — в своём try: падение expand/fullscreen
   * не должно отменять ready (иначе Telegram покажет спиннер
   * «загрузка» поверх уже готового приложения).
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

    // Скрипт уже синхронно в head (app.blade.php) — здесь лишь
    // страховка на случай блокировки CDN: динамическая догрузка.
    const loaded = await loadScript()
    const webApp = getWebApp()

    if (!loaded || !webApp) {
      return false
    }

    try {
      webApp.ready()
    } catch {
      // No-op: без ready клиент висит на сплэше — пробуем дальше.
    }

    try {
      webApp.expand()
    } catch {
      // No-op: expand не критичен для рендера.
    }

    // Версионные методы вызываем только при поддержке: на старых
    // клиентах (6.0) каждый такой вызов — варнинг в консоль.
    if (webAppSupports(webApp, '7.1')) {
      try {
        webApp.disableVerticalSwipes?.()
      } catch {
        // No-op.
      }
    }

    if (webAppSupports(webApp, '8.0')) {
      try {
        if (typeof webApp.requestFullscreen === 'function' && !webApp.isFullscreen) {
          webApp.requestFullscreen()
        }
      } catch {
        // No-op: fullscreen доступен не везде.
      }
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
      webApp.onEvent('safeAreaChanged', () => applyTelegramInsets(webApp))
      webApp.onEvent('contentSafeAreaChanged', () => applyTelegramInsets(webApp))
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
    tgSafeTop,
    tgSafeBottom,
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
