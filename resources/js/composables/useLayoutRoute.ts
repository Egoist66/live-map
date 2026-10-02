import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { route } from '@/route'
import { normalizeSwipeTab } from '@/composables/useSwipes'

/**
 * Реактивный маршрут для персистентного лейаута.
 *
 * Ziggy `route().current()` читает `window.location` напрямую и не реактивен:
 * `computed` без реактивных зависимостей вычисляется один раз и замирает
 * на первой странице сессии. В `AuthenticatedLayout` так замерзал `isSwipesFeed`:
 * сессия, начатая на `/swipes` (диплинк, refresh, возврат на последний экран,
 * рестарт PWA), навсегда оставляла `main` в `overflow-hidden` — после ухода
 * в профиль страница не скроллилась на мобиле до перезагрузки.
 *
 * Хук держит счётчик навигаций (`router.on('navigate')`) и ссылается на него
 * во всех флагах, поэтому они пересчитываются при каждом переходе Inertia,
 * а семантика имён Ziggy (`swipes`, `swipes.tab`, `chat`, `map`, `swipes*`)
 * сохраняется один в один.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const layoutRoute = useLayoutRoute()
 * </script>
 *
 * <template>
 *   <main :class="layoutRoute.isScrollLockedPage.value ? 'overflow-hidden' : ''">
 *     <slot />
 *   </main>
 * </template>
 * ```
 *
 * @returns счётчик навигаций и флаги текущего маршрута
 */
export function useLayoutRoute() {
  const navTick = ref(0)

  let stopNavigate: (() => void) | null = null

  /**
   * Продвигает счётчик навигаций: инвалидирует все флаги маршрута.
   */
  function syncRouteTick(): void {
    navTick.value += 1
  }

  onMounted(() => {
    syncRouteTick()

    try {
      stopNavigate = router.on('navigate', () => syncRouteTick())
    } catch {
      stopNavigate = null
    }
  })

  onBeforeUnmount(() => {
    try {
      stopNavigate?.()
    } catch {
      // No-op: подписки уже нет.
    }

    stopNavigate = null
  })

  /**
   * Текущий Ziggy-роут: обёртка с тихим фолбэком для SSR.
   *
   * @param name имя или маска роута вроде `'swipes*'`
   * @returns true если текущий роут совпадает
   */
  function isCurrent(name: string): boolean {
    try {
      return route().current(name)
    } catch {
      return false
    }
  }

  /**
   * Открыт чат (`/chat`, `/chat/5`): фрейм без скролла страницы.
   */
  const isChatRoute = computed(() => {
    navTick.value

    return isCurrent('chat')
  })

  /**
   * Открыто «Избранное» (`/notes`): чат с собой, фрейм без скролла
   * страницы — как у чата.
   */
  const isNotesRoute = computed(() => {
    navTick.value

    return isCurrent('notes')
  })

  /**
   * Открыта карта (`/map`): фрейм без скролла страницы.
   */
  const isMapRoute = computed(() => {
    navTick.value

    return isCurrent('map')
  })

  /**
   * Открыты свайпы, любой таб (`/swipes`, `/swipes/active`, …):
   * своя шапка, без общего хедера и дока мини-чата.
   */
  const isSwipesRoute = computed(() => {
    navTick.value

    return isCurrent('swipes*')
  })

  /**
   * Лента свайпов (`/swipes`, `/swipes/tape`): deck живёт в запертом
   * скроллере без нижнего меню, как в Tinder. Контентные табы
   * (`/swipes/active`, `/swipes/questionnaire`, …) — обычные страницы:
   * скроллятся родителем, нижнее меню видно.
   */
  const isSwipesFeed = computed(() => {
    navTick.value

    try {
      if (route().current('swipes')) {
        return true
      }

      if (!route().current('swipes.tab')) {
        return false
      }

      const tab = String((route().params as any)?.tab ?? '')

      return normalizeSwipeTab(tab) === 'feed'
    } catch {
      return false
    }
  })

  /**
   * Страница-фрейм без скролла родителя: чат, избранное, карта
   * или лента свайпов.
   */
  const isScrollLockedPage = computed(
    () => isChatRoute.value || isNotesRoute.value || isMapRoute.value || isSwipesFeed.value,
  )

  return { navTick, isChatRoute, isNotesRoute, isMapRoute, isSwipesRoute, isSwipesFeed, isScrollLockedPage }
}
