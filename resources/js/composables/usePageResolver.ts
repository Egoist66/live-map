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

        if (isClient) {
          window.location.reload()
        }

        throw firstError
      }
    }
  }

  return { resolvePage }
}
