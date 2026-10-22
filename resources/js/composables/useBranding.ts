import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Публичные данные брендинга из общих Inertia-пропсов.
 */
export interface BrandingAsset {
  /** Версионированный публичный URL файла. */
  url: string
  /** Загружен ли файл через админку. */
  is_custom: boolean
}

/**
 * Состояние брендинга, которое отдаёт `HandleInertiaRequests`.
 */
export interface BrandingState {
  /** Иконка приложения для логотипа и PWA. */
  app_icon: BrandingAsset
  /** Favicon для вкладки браузера. */
  favicon: BrandingAsset
  /** Общая версия для сброса кэша манифеста. */
  version: string
}

const DEFAULT_BRANDING: BrandingState = {
  app_icon: { url: '/pwa-192x192.png?v=2', is_custom: false },
  favicon: { url: '/favicon.ico?v=2', is_custom: false },
  version: '2',
}

/**
 * Доступ к актуальной иконке приложения и favicon.
 *
 * @returns Пропсы брендинга и готовые URL с фолбэками.
 *
 * @example
 * const { appIconUrl } = useBranding()
 */
export function useBranding() {
  const page = usePage()
  const branding = computed<BrandingState>(() => {
    const shared = page.props.branding as Partial<BrandingState> | undefined

    if (!shared?.app_icon || !shared?.favicon) {
      return DEFAULT_BRANDING
    }

    return {
      app_icon: shared.app_icon,
      favicon: shared.favicon,
      version: shared.version ?? DEFAULT_BRANDING.version,
    }
  })

  const appIconUrl = computed(() => branding.value.app_icon.url || DEFAULT_BRANDING.app_icon.url)
  const faviconUrl = computed(() => branding.value.favicon.url || DEFAULT_BRANDING.favicon.url)

  return { branding, appIconUrl, faviconUrl }
}
