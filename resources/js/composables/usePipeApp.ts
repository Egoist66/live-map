import { computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'

/**
 * Общий конфиг мини-сайта Pipe (pipe.ulove.by).
 *
 * Главный сайт живёт на отдельном домене: route() на pipe-запросе
 * не балансирует туда (роуты главного сайта без host-группы метают
 * в текущий host), поэтому все ссылки на ULove строятся от
 * абсолютного origin из shared-пропса `appUrl` (config('app.url')).
 *
 * @example
 * const { appUrl, mainHref } = usePipeApp()
 * <a :href="mainHref('/flow')">ULove</a>
 */
export function usePipeApp() {
  const appUrl = computed<string>(() => {
    const raw = (usePage().props as { appUrl?: string }).appUrl
    return raw && raw !== '' ? raw : ''
  })

  /**
   * Абсолютная ссылка на главный сайт.
   *
   * @param path путь на главном сайте ('/flow', '/login', ...)
   * @returns абсолютный URL (fallback на относительный путь в SSR-пустом origin)
   */
  function mainHref(path: string): string {
    return appUrl.value ? `${appUrl.value}${path}` : path
  }

  /**
   * Проверяет, что ссылка ведёт на тот же origin, где сейчас рендерится приложение.
   *
   * Pipe живёт на своём домене (prod: pipe.ulove.by), но в локальном окружении
   * смонтирован префиксом /pipe на том же хосте, что и главный сайт. SPA-переход
   * возможен только в same-origin случае, иначе Inertia уйдёт XHR-ом в чужой origin.
   *
   * @param href абсолютная или относительная ссылка
   * @returns true, если переход можно выполнить через router.visit
   */
  function isSameOrigin(href: string): boolean {
    if (typeof window === 'undefined') return false
    try {
      const targetUrl = new URL(href, window.location.origin)
      return targetUrl.origin === window.location.origin
    } catch {
      return false
    }
  }

  /**
   * Переход на страницу главного сайта: SPA без перезагрузки, если главный сайт
   * в том же origin (локальный dev), иначе полный переход (кросс-домен в prod).
   *
   * @param path путь на главном сайте ('/users/1', '/login', ...)
   * @param options опции Inertia-визита (preserveScroll и т.п.)
   *
   * @example
   * const { visitMain } = usePipeApp()
   * visitMain(`/users/${authorId}`) // SPA в dev, полный переход в prod
   */
  function visitMain(path: string, options?: Parameters<typeof router.visit>[1]): void {
    const href = mainHref(path)
    if (isSameOrigin(href)) {
      router.visit(href, options)
      return
    }
    window.location.href = href
  }

  return { appUrl, mainHref, visitMain }
}
