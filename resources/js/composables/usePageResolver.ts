import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { applyPersistentLayout } from '@/composables/usePersistentLayout'
import type { DefineComponent } from 'vue'

/**
 * Резолвер Inertia-страниц с одной повторной попыткой и жёстким fallback.
 *
 * Зачем: динамический import страницы может упасть — в dev холодный
 * transform тяжёлой страницы не укладывается в таймаут прокси (504,
 * `Failed to fetch dynamically imported module`), на проде после деплоя
 * можно приехать в stale-чанк. Без обработки визит умирает с uncaught
 * promise и мёртвым экраном. Повтор обычно подбирает уже прогретый
 * модуль; если нет — полная перезагрузка подтягивает свежий манифест.
 *
 * Вынесен из `app.ts` по Правилу №1 (логика — в хуках).
 *
 * @example
 * ```ts
 * const pageModules = import.meta.glob('./Pages/...vue')
 * const { resolvePage } = usePageResolver(pageModules)
 * createInertiaApp({ resolve: (name) => resolvePage(name) })
 * ```
 *
 * @param pageModules модули страниц из `import.meta.glob` по папке Pages
 * @returns резолвер страницы для `createInertiaApp({ resolve })`
 */
export function usePageResolver(pageModules: Record<string, () => Promise<DefineComponent>>) {
  /** Пауза перед повтором, чтобы Vite в dev успел прогреть transform. */
  const RETRY_DELAY_MS = 800
  /** Максимум жёстких перезагрузок страницы за окно — дальше петля, стоим. */
  const MAX_RELOADS = 2
  /** Окно счётчика перезагрузок. */
  const RELOAD_WINDOW_MS = 5 * 60 * 1000

  /**
   * Загрузить модуль страницы и назначить персистентный лейаут.
   *
   * @param name имя Inertia-страницы (например `'Dashboard'`)
   * @returns модуль страницы с назначенным лейаутом
   */
  async function loadPage(name: string) {
    const pagePath = `./Pages/${name}.vue`
    const module = await resolvePageComponent<DefineComponent>(pagePath, pageModules)
    const component = module as unknown as { default: unknown }
    applyPersistentLayout(name, component.default)

    return module
  }

  /**
   * Пауза перед повтором загрузки чанка.
   *
   * @returns void
   */
  async function waitForRetry(): Promise<void> {
    await new Promise((done) => setTimeout(done, RETRY_DELAY_MS))
  }

  /**
   * Резолвер для Inertia: грузит страницу, при сбое — одна повторная
   * попытка, при повторном сбое на клиенте — жёсткая перезагрузка
   * на свежий манифест. На SSR (`window` нет) — просто проброс ошибки,
   * перезагружаться там некуда и нечем.
   *
   * Петля от бесконечных перезагрузок закрыта счётчиком: больше
   * MAX_RELOADS за RELOAD_WINDOW_MS — не перезагружаемся, а бросаем
   * исходную ошибку (видно реальную причину, а не вечный спиннер).
   *
   * @param name имя Inertia-страницы
   * @returns модуль страницы
   * @throws исходная ошибка загрузки
   */
  async function resolvePage(name: string) {
    try {
      const fresh = await loadPage(name)

      return fresh
    } catch (firstError) {
      await waitForRetry()

      try {
        const retried = await loadPage(name)

        return retried
      } catch {
        const isClient = typeof window !== 'undefined'

        if (isClient && allowReload(name)) {
          window.location.reload()
        }

        throw firstError
      }
    }
  }

  /**
   * Можно ли сейчас жёстко перезагрузиться под эту страницу.
   *
   * Счётчик в sessionStorage: пережил reload, умер со вкладкой.
   * Истёкшее окно сбрасывается — разовые сбои через час снова лечатся.
   * Хранилище недоступно (приватный режим, блокировка cookies) —
   * НЕ перезагружаемся: без счётчика это вечный цикл reload'ов
   * (вкладка «бесконечно грузится», браузер предлагает её убить),
   * а так бросаем исходную ошибку и видна реальная причина.
   *
   * @param name имя Inertia-страницы
   * @returns true если лимит перезагрузок не исчерпан (и счётчик записан)
   */
  function allowReload(name: string): boolean {
    try {
      const key = `upin:page-reload:${name}`
      const raw = sessionStorage.getItem(key)
      const now = Date.now()
      const parsed = raw ? (JSON.parse(raw) as { count?: number; firstAt?: number }) : null
      const fresh = parsed && now - (parsed.firstAt ?? 0) < RELOAD_WINDOW_MS
      const count = fresh ? Number(parsed?.count ?? 0) : 0

      if (count >= MAX_RELOADS) {
        return false
      }

      sessionStorage.setItem(key, JSON.stringify({ count: count + 1, firstAt: fresh ? parsed?.firstAt : now }))

      return true
    } catch {
      return false
    }
  }

  return { resolvePage }
}
