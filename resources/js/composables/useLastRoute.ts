import { router } from '@inertiajs/vue3'

const STORAGE_KEY = 'upin:last-route'

/** Префиксы служебных страниц, которые не запоминаем и не открываем. */
const EXCLUDED_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/confirm-password',
  '/terms',
]

let bound = false

/**
 * Возврат на последний экран после перезапуска.
 *
 * Запоминает каждый внутренний переход (`uid|path`). Штатно холодный
 * старт авторизованного сервер уже редиректит с `/` в `/profile`
 * (см. `PageController@welcome`), так что ветка ниже — страховка
 * на случай протухшего PWA-кэша `/`: увозит туда, где пользователь
 * был, хоть профиль, хоть чат. Гостей не трогает.
 *
 * @returns remember/restore/forget для последнего маршрута
 * @example
 * const { initLastRoute } = useLastRoute()
 * await initLastRoute(currentUid)
 */
export function useLastRoute() {
  /**
   * Проверяет, что путь внутренний и пригоден для возврата.
   *
   * @param path путь для проверки
   * @returns true если путь можно запоминать/открывать
   */
  function isRestorable(path: string): boolean {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      return false
    }
    if (path === '/') {
      return false
    }
    const clean = path.split('?')[0].split('#')[0]
    return !EXCLUDED_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`))
  }

  /**
   * Читает сохранённую запись `uid|path`.
   *
   * @returns запись или null
   */
  async function readStored(): Promise<{ uid: string; path: string } | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return null
      }
      const separator = raw.indexOf('|')
      if (separator <= 0) {
        return null
      }
      const uid = raw.slice(0, separator)
      const path = raw.slice(separator + 1)
      if (!isRestorable(path)) {
        return null
      }
      return { uid, path }
    } catch {
      return null
    }
  }

  /**
   * Запоминает текущий экран пользователя.
   *
   * @param uid id пользователя
   * @param path текущий путь
   * @returns void
   */
  async function remember(uid: number | string, path: string): Promise<void> {
    if (!uid || !isRestorable(path)) {
      return
    }
    const value = `${uid}|${path}`
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {}
  }

  /**
   * Забывает последний экран (выход из аккаунта).
   *
   * @returns void
   */
  async function forget(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  /**
   * Подписывает запоминание и возвращает на последний экран при холодном старте.
   *
   * Холодный старт = открыт `/` авторизованным (страховка: штатно сервер
   * уже редиректит таких в `/profile`). Цель — сохранённый путь
   * того же пользователя, иначе `/profile`.
   *
   * @param uid id текущего пользователя (0/гость — только подписка)
   * @returns void
   */
  async function initLastRoute(uid: number | string): Promise<void> {
    if (!bound) {
      bound = true
      router.on('navigate', () => {
        try {
          const current = `${window.location.pathname}${window.location.search}`
          const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
          const liveUid = Number(meta || (window as unknown as { userId?: number }).userId || 0)
          if (liveUid) {
            void remember(liveUid, current)
          }
        } catch {}
      })
    }
    const numericUid = Number(uid) || 0
    if (!numericUid) {
      return
    }
    if (window.location.pathname !== '/') {
      return
    }
    const stored = await readStored()
    const target = stored && String(stored.uid) === String(numericUid) ? stored.path : '/profile'
    try {
      router.visit(target, { replace: true })
    } catch {}
  }

  return { initLastRoute, rememberLastRoute: remember, forgetLastRoute: forget }
}
