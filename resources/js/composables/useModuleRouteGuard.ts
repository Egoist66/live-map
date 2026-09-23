import { router, usePage } from '@inertiajs/vue3'
import { useAppModulesStore, type AppModule } from '@/stores/appModules'

let listening = false

/**
 * Префикс пути → модуль раздела.
 *
 * @param pathname путь без query
 * @returns модуль или null для общего ядра (чат, профиль, настройки)
 */
function moduleOf(pathname: string): AppModule | null {
  if (pathname === '/swipes' || pathname.startsWith('/swipes/')) {
    return 'ulove'
  }

  if (pathname === '/map' || pathname.startsWith('/map/')) {
    return 'upin'
  }

  if (pathname === '/flow' || pathname.startsWith('/flow/')) {
    return 'uflow'
  }

  if (pathname === '/districts' || pathname.startsWith('/districts/')) {
    return 'districts'
  }

  if (pathname === '/cabinet' || pathname.startsWith('/cabinet/')) {
    return 'business'
  }

  return null
}

/**
 * Гард роутов по модулям для авторизованных.
 *
 * Выключенный раздел недоступен даже прямым URL: визит отменяется
 * и открывается домашний экран включённого модуля (его чанк уже
 * подгрузится лениво по требованию). Гости, legacy и staff — без ограничений.
 *
 * @example useModuleRouteGuard().init()
 */
export function useModuleRouteGuard() {
  /**
   * Подписаться на визиты Inertia (идемпотентно).
   */
  function init(): void {
    if (listening) {
      return
    }

    listening = true

    try {
      router.on('before', (event: any) => {
        let pathname = ''

        try {
          pathname = new URL(event.detail.visit.url, window.location.origin).pathname
        } catch {
          return
        }

        const module = moduleOf(pathname)

        if (!module) {
          return
        }

        let user: any = null

        try {
          user = (usePage().props as any)?.auth?.user ?? null
        } catch {
          return
        }

        if (!user) {
          return
        }

        if (user.account_type === 'business' && (module === 'business' || module === 'upin')) {
          return
        }

        let allowed = true
        let home = '/'

        try {
          const modules = useAppModulesStore()
          allowed = modules.isEnabled(module)
          home = modules.homeFor(user.account_type ?? null)
        } catch {
          return
        }

        if (allowed) {
          return
        }

        try {
          event.preventDefault()
        } catch {
        }

        try {
          router.visit(home)
        } catch {
        }
      })
    } catch {
      listening = false
    }
  }

  return { init }
}
