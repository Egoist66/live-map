import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { applyPersistentLayout } from '@/composables/usePersistentLayout'
import { buildCacheBustedUrl, consumeRecoveryReload } from '@/composables/useBootRecovery'
import type { DefineComponent } from 'vue'

/**
 * Резолвер Inertia-страниц с одной повторной попыткой и жёстким fallback.
 *
 * Зачем: динамический import страницы может упасть — в dev холодный
 * transform тяжёлой страницы не укладывается в таймаут прокси (504,
 * `Failed to fetch dynamically imported module`), на проде после деплоя
 * можно приехать в stale-чанк. Без обработки визит умирает с uncaught
 * promise и мёртвым экраном. Повтор обычно подбирает уже прогретый
 * модуль; если нет — перезагрузка на свежий манифест.
 *
 * Бюджет перезагрузок общий со сторожем blade и глобальным хендлером
 * (`consumeRecoveryReload` из `useBootRecovery`): максимум 2 за 5 минут
 * на всё, вторая — с `?v=` мимо SW/HTTP-кэшей (иначе reload отдаёт тот же
 * протухший HTML и визит умирает в цикле). Дальше — исходная ошибка
 * (видно реальную причину) и фолбэк-панель сторожа.
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
   * попытка, при повторном сбое на клиенте — перезагрузка из общего
   * бюджета (`useBootRecovery`, максимум 2 за 5 минут на всё).
   * На SSR (`window` нет) — просто проброс ошибки, перезагружаться
   * там некуда и нечем.
   *
   * Бюджет исчерпан — бросаем исходную ошибку (видно реальную причину,
   * а не вечный спиннер), фолбэк покажет сторож blade.
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
          reloadToFreshBuild()
        }

        throw firstError
      }
    }
  }

  /**
   * Перезагрузиться на свежий билд из общего бюджета.
   *
   * Первая попытка мягкая, вторая — с `?v=` мимо кэшей
   * (`stripRefreshParam` в `useBuildVersion` чистит параметр после бута).
   * Бюджет исчерпан — ничего не делаем: ошибку выше увидит глобальный
   * хендлер, фолбэк покажет сторож blade.
   */
  function reloadToFreshBuild(): void {
    const mode = consumeRecoveryReload()

    if (mode === 'bust') {
      window.location.replace(buildCacheBustedUrl())
    } else if (mode === 'reload') {
      window.location.reload()
    }
  }

  return { resolvePage }
}
