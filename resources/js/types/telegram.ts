/**
 * Типы Telegram WebApp JS API (Mini Apps, Bot API 7-8).
 * Минимальный сабсет, нужный мосту useTelegram.
 */

export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface TelegramWebAppInitDataUnsafe {
  user?: TelegramWebAppUser
  start_param?: string
  auth_date?: string
  hash?: string
}

export interface TelegramWebAppThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  /** Bot API 6.1+: акцентный текст (ссылки второго уровня). */
  accent_text_color?: string
  /** Bot API 7.0+: фон секций (вторичные карточки). */
  section_bg_color?: string
  section_header_text_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
  bottom_bar_bg_color?: string
}

export interface TelegramWebAppViewport {
  height: number
  isExpanded: boolean
  isStable: boolean
}

/**
 * Отступы безопасной зоны от Telegram (Bot API 8.0).
 *
 * В полноэкранном Mini App `env(safe-area-inset-*)` в WebView равен нулю —
 * чёлку/вырезы отдаёт только этот объект. `contentSafeAreaInset`
 * предпочтительнее: это зона именно под контент.
 */
export interface TelegramSafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Параметры нативной нижней кнопки (MainButton / SecondaryButton).
 */
export interface TelegramMainButtonParams {
  text?: string
  color?: string
  text_color?: string
  is_active?: boolean
  is_visible?: boolean
}

export interface TelegramMainButton {
  text: string
  color: string
  textColor: string
  isVisible: boolean
  isActive: boolean
  isProgressVisible: boolean
  setText: (text: string) => void
  setParams: (params: TelegramMainButtonParams) => void
  show: () => void
  hide: () => void
  enable: () => void
  disable: () => void
  showProgress: (leaveActive?: boolean) => void
  hideProgress: () => void
  onClick: (handler: () => void) => void
  offClick: (handler: () => void) => void
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: TelegramWebAppInitDataUnsafe
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: TelegramWebAppThemeParams
  isExpanded: boolean
  /** Bot API 8.0+: открыт ли полноэкранный режим. */
  isFullscreen?: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  /** Недекорированная зона всего Mini App (Bot API 8.0, может отсутствовать). */
  safeAreaInset?: TelegramSafeAreaInset
  /** Зона под контент (Bot API 8.0, может отсутствовать). */
  contentSafeAreaInset?: TelegramSafeAreaInset
  ready: () => void
  expand: () => void
  close: () => void
  /**
   * Проверка версии клиента (Bot API 6.2+, на 6.0 отсутствует).
   * Сама библиотека внутри гейтит методы версией и спамит
   * варнингами в консоль — поэтому версию проверяем ДО вызова.
   */
  isVersionAtLeast?: (version: string) => boolean
  /** Bot API 8.0+: развернуть в полноэкранный режим. */
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  /** Bot API 7.1+: запретить свайпом схлопывать Mini App обратно. */
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  enableClosingConfirmation: () => void
  disableClosingConfirmation: () => void
  onEvent: (event: string, handler: (...args: unknown[]) => void) => void
  offEvent: (event: string, handler: (...args: unknown[]) => void) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  openTelegramLink: (url: string) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (ok: boolean) => void) => void
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (handler: () => void) => void
    offClick: (handler: () => void) => void
  }
  MainButton: TelegramMainButton
  /** Bot API 8.0+: вторая нижняя кнопка (может отсутствовать в старых клиентах). */
  SecondaryButton?: TelegramMainButton
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}
