import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { applyPersistentLayout } from '@/composables/usePersistentLayout'
import { buildCacheBustedUrl, consumeRecoveryReload } from '@/composables/useBootRecovery'
import type { DefineComponent } from 'vue'

/**
 * Резолвер Inertia-страниц с повторами и жёстким fallback.
 *
 * Зачем: динамический import страницы может упасть — в dev холодный
 * transform тяжёлой страницы не укладывается в таймаут прокси (504,
 * `Failed to fetch dynamically imported module`), на проде после деплоя
 * можно приехать в stale-чанк. Без обработки визит умирает с uncaught
 * promise и мёртвым экраном. Повторы с бэкоффом обычно подбирают уже
 * прогретый модуль; если нет — перезагрузка на свежий манифест.
 *
 * Бюджет перезагрузок общий со сторожем blade и глобальным хендлером
 * (`consumeRecoveryReload` из `useBootRecovery`): максимум 2 за 5 минут
 * на всё, всегда с `?v=` мимо SW/HTTP-кэшей (иначе reload отдаёт тот же
 * протухший HTML и визит умирает в цикле). Дальше — исходная ошибка
 * (видно реальную причину) и панель границы ошибок роута.
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
  /**
   * Паузы перед повторами: первая — прогреть transform в dev,
   * вторая — пережить короткий рестарт/гонку rolling-деплоя.
   */
  const RETRY_DELAYS_MS = [800, 2000]

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
   * @param ms сколько ждать
   * @returns void
   */
  async function waitForRetry(ms: number): Promise<void> {
    await new Promise((done) => setTimeout(done, ms))
  }

  /**
   * Резолвер для Inertia: грузит страницу, при сбое — два повторных
   * захода с бэкоффом, при итоговом сбое на клиенте — перезагрузка
   * сразу на свежий билд из общего бюджета (`useBootRecovery`,
   * максимум 2 за 5 минут на всё). На SSR (`window` нет) — просто
   * проброс ошибки, перезагружаться там некуда и нечем.
   *
   * Перезагрузка всегда с `?v=` мимо кэшей, а не мягкая: мягкая может
   * вернуть тот же протухший HTML из SW/HTTP-кэша и визит умрёт в цикле.
   * Параметр чистит `stripRefreshParam` в `useBuildVersion` после бута.
   *
   * Бюджет исчерпан — бросаем исходную ошибку (видно реальную причину,
   * а не вечный спиннер), фолбэк покажет граница ошибок роута.
   *
   * @param name имя Inertia-страницы
   * @returns модуль страницы
   * @throws исходная ошибка загрузки
   */
  async function resolvePage(name: string) {
    let firstError: unknown = null

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const fresh = await loadPage(name)

        return fresh
      } catch (error) {
        if (firstError === null) {
          firstError = error
        }

        const delay = RETRY_DELAYS_MS[attempt]

        if (delay !== undefined) {
          await waitForRetry(delay)
        }
      }
    }

    const isClient = typeof window !== 'undefined'

    if (isClient) {
      reloadToFreshBuild()
    }

    throw firstError
  }

  /**
   * Перезагрузиться на свежий билд из общего бюджета.
   *
   * Всегда с `?v=` мимо SW/HTTP-кэшей: мягкий reload отдаёт тот же
   * протухший HTML и визит умирает в цикле.
   * Бюджет исчерпан — ничего не делаем: ошибку выше увидит глобальный
   * хендлер и граница ошибок роута.
   */
  function reloadToFreshBuild(): void {
    const mode = consumeRecoveryReload()

    if (mode === null) {
      return
    }

    window.location.replace(buildCacheBustedUrl())
  }

  return { resolvePage }
}
