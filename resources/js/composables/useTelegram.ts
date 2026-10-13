import { computed, ref } from 'vue'
import type { TelegramWebApp, TelegramWebAppUser } from '@/types/telegram'
import { syncThemeWithTelegram } from '@/composables/useTheme'

const SCRIPT_URL = 'https://telegram.org/js/telegram-web-app.js'
const TG_COOKIE = 'upin_client=telegram; path=/; max-age=31536000; SameSite=Lax'

const isTelegram = ref(false)
/** Десктопный клиент Telegram (tdesktop/macos/windows/linux/web на ПК). */
const isDesktopTelegram = ref(false)
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
/** Последняя схема, которой уже подчинили тему сайта (защита ручного выбора). */
let lastSyncedScheme: 'light' | 'dark' | null = null

/**
 * Достать сырой WebApp-объект, если скрипт уже загружен.
 *
 * ВНИМАНИЕ: наличие объекта НЕ означает «внутри Telegram» —
 * `telegram-web-app.js` определяет его всегда, даже в обычном десктопном
 * Chrome (там `initData` пуст, `platform` unknown). Для ответа на вопрос
 * «мы в Mini App?» используй `hasRealTelegramEvidence()`.
 *
 * @returns WebApp или null когда скрипт ещё не загружен
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
 * Строгая проверка «страница реально открыта внутри Telegram Mini App».
 *
 * Голого `window.Telegram.WebApp` недостаточно: скрипт `telegram-web-app.js`
 * грузится синхронно в head каждой страницы и определяет объект даже
 * в обычном десктопном Chrome. Без строгой проверки десктоп ставил себе
 * годовую куку `upin_client=telegram`, бэк (`NativeClientDetector`)
 * принимал браузер за «натива» и тушил SSR — весь десктопный трафик
 * получал пустой `div#app` (CSR) и `noindex` вместо предрендера и SEO.
 *
 * Доказательства Mini App: непустой `initData` (его подписывает и кладёт
 * только настоящий клиент) либо tgWebApp-маркеры в URL (search + hash).
 *
 * @returns true только внутри настоящего Telegram-клиента
 */
function hasRealTelegramEvidence(): boolean {
  if (hasTelegramQuery()) {
    return true
  }

  try {
    const initData = getWebApp()?.initData

    return typeof initData === 'string' && initData.length > 0
  } catch {
    return false
  }
}

/**
 * Удалить отравленную куку telegram-маркера (самовосстановление десктопа).
 *
 * Десктопные браузеры, успевшие получить `upin_client=telegram` от прежней
 * версии скрипта, чинят себя сами при первом же визите: без маркера бэк
 * снова отдаёт им SSR-предрендер.
 *
 * @returns void
 */
function clearStaleTelegramMarker(): void {
  try {
    if (/(?:^|;\s*)upin_client=telegram(-webapp)?(?:;|$)/.test(document.cookie)) {
      document.cookie = 'upin_client=; path=/; max-age=0; SameSite=Lax'
    }
  } catch {
    // No-op: кука необязательна.
  }
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
 * Десктопный ли это клиент Telegram (окно/панель на ПК, а не телефон).
 *
 * Платформы Bot API: 'android'/'android_x'/'ios' — мобильная ОС;
 * 'tdesktop'/'macos'/'windows'/'linux'/'web'/'weba'/'webk'/'unigram' — десктоп.
 * Отдельно: 'unknown'/пусто (старый клиент не сообщил платформу) —
 * решаем по вводу и ширине: тач + узкий экран = телефон, иначе десктоп.
 * Без этого телефон с unknown-платформой получал десктопный режим
 * (без expand — схлопнутый полуэкран), а десктоп с тачскрином —
 * мобильный (expand уводил WebView в немасштабируемое окно справа,
 * которое «не двигается и не закрыть»).
 *
 * Десктопный Mini App живёт в узкой боковой панели справа (Windows/macOS):
 * там нет жестов и полноэкранного режима — requestFullscreen/expand
 * уводят окно в немасштабируемое состояние «справа и не закрыть»,
 * поэтому их вызываем только на мобиле.
 *
 * @param webApp живой объект Telegram WebApp
 * @returns true когда Mini App открыт в Telegram Desktop
 */
export function isDesktopTelegramPlatform(webApp: TelegramWebApp): boolean {
  const rawPlatform = String(webApp?.platform || '').toLowerCase()

  const isMobileOs = rawPlatform.startsWith('android') || rawPlatform.startsWith('ios')

  if (isMobileOs) {
    return !hasCoarsePointer()
  }

  return !isNarrowTouchScreen()
}

/**
 * Есть ли у устройства грубый указатель (тачскрин).
 *
 * @returns true когда primary-ввод — тач
 */
function hasCoarsePointer(): boolean {
  try {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false
  } catch {
    return false
  }
}

/**
 * Узкий тач-экран: телефон в браузере или в неизвестном клиенте.
 *
 * Десктоп с тачскрином (моноблок/ноутбук) сюда не попадает —
 * там широкий экран, режим остаётся десктопным.
 *
 * @returns true когда тач + ширина телефона
 */
function isNarrowTouchScreen(): boolean {
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false

    return coarse && window.innerWidth < 768
  } catch {
    return false
  }
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

  if (lastSyncedScheme !== colorScheme.value) {
    lastSyncedScheme = colorScheme.value
    syncThemeWithTelegram(colorScheme.value)
  }

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
  const rawTop = Math.max(0, Math.round(inset?.top ?? 0))
  const rawBottom = Math.max(0, Math.round(inset?.bottom ?? 0))

  // Живое обновление зазора под нативные кнопки клиента
  // (см. ранний инлайн в app.blade.php): только тач-устройства
  // на мобильных платформах Telegram (android*/ios*) —
  // в десктопном клиенте кнопок поверх WebView нет, а инсеты
  // десктопного клиента раздували бы шапку (.native-safe-top),
  // поэтому на десктопе инсеты принудительно нули
  // + класс tg-desktop (CSS обнуляет паддинг шапки,
  // мобилка tg-mobile отступы сохраняет).
  // Десктоп/мобила — единый предикат isDesktopTelegramPlatform
  // (платформа + тач + ширина), без дублирования эвристик.
  const isDesktopTg = isDesktopTelegramPlatform(webApp)
  const top = isDesktopTg ? 0 : rawTop
  const bottom = isDesktopTg ? 0 : rawBottom

  tgSafeTop.value = top
  tgSafeBottom.value = bottom
  isDesktopTelegram.value = isDesktopTg

  try {
    const root = document.documentElement
    root.style.setProperty('--tg-sat', `${top}px`)
    root.style.setProperty('--tg-sab', `${bottom}px`)
    root.classList.toggle('tg-desktop', isDesktopTg)
    root.classList.toggle('tg-mobile', !isDesktopTg)
    const chromeTop = !isDesktopTg ? Math.max(0, 48 - top) : 0
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

    const inTelegram = hasRealTelegramEvidence()

    if (!inTelegram) {
      clearStaleTelegramMarker()

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

    const desktopTg = isDesktopTelegramPlatform(webApp)
    isDesktopTelegram.value = desktopTg

    // Десктопный клиент (Windows/macOS): только ready, без expand/fullscreen.
    // expand/requestFullscreen в боковой панели десктопа уводят WebView
    // в немасштабируемое окно справа («не двигается, не закрыть»).
    // На мобиле — как было: expand + запрет схлопывания + fullscreen.
    if (!desktopTg) {
      try {
        webApp.expand()
      } catch {
        // No-op: expand не критичен для рендера.
      }
    }

    // Версионные методы вызываем только при поддержке: на старых
    // клиентах (6.0) каждый такой вызов — варнинг в консоль.
    // На десктопе вертикальных свайпов нет — не трогаем.
    if (!desktopTg && webAppSupports(webApp, '7.1')) {
      try {
        webApp.disableVerticalSwipes?.()
      } catch {
        // No-op.
      }
    }

    if (!desktopTg && webAppSupports(webApp, '8.0')) {
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
    if (hasRealTelegramEvidence()) {
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

    const inTelegram = hasRealTelegramEvidence()

    if (!inTelegram) {
      clearStaleTelegramMarker()

      return false
    }

    isTelegram.value = true

    try {
      const earlyWebApp = getWebApp()

      if (earlyWebApp) {
        isDesktopTelegram.value = isDesktopTelegramPlatform(earlyWebApp)
      }
    } catch {
      // No-op.
    }

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
    isDesktopTelegram,
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
 * Проверить, что страница открыта внутри настоящего Telegram-клиента
 * (без инициализации моста).
 *
 * Для axios-интерцептора, где нельзя ждать initTelegram. Строгая:
 * голого `window.Telegram.WebApp` недостаточно (см. `hasRealTelegramEvidence`).
 *
 * @returns true при initData или tgWebApp-маркерах в URL
 */
export function isTelegramWebView(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return hasRealTelegramEvidence()
}
