import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import type { useSwipes, SwipeTab } from '@/composables/useSwipes'

type SwipesStore = ReturnType<typeof useSwipes>
type SwipesMatch = { user: { id: number }; conversation_id: number | null }

/**
 * Боковое мини-меню свайпов для мобильной версии.
 *
 * Держит состояние Drawer и переключает табы ленты:
 * лента / активные / избранное / лайки.
 * Компонент только отображает состояние хука.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const mobileMenu = useSwipesMobileMenu()
 * await mobileMenu.selectTab(s, 'admirers')
 * </script>
 * ```
 *
 * @returns состояние меню и действия
 */
export function useSwipesMobileMenu() {
  const isOpen = ref(false)

  /**
   * Открыть боковое меню.
   */
  function open(): void {
    isOpen.value = true
  }

  /**
   * Закрыть боковое меню.
   */
  function close(): void {
    isOpen.value = false
  }

  /**
   * Переключить видимость меню.
   */
  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  /**
   * Выбрать таб свайпов и закрыть меню.
   *
   * Переходит отдельным роутом, чтобы работала стрелка назад.
   * Повторный клик по текущему табу просто обновляет данные.
   *
   * @param store стор свайпов из useSwipes
   * @param tab таб для открытия
   */
  async function selectTab(store: SwipesStore, tab: SwipeTab): Promise<void> {
    const loaders: Record<SwipeTab, () => Promise<unknown>> = {
      feed: async () => store.loadFeed(),
      active: async () => store.loadActive(),
      favorites: async () => store.loadFavorites(),
      admirers: async () => store.loadAdmirers(),
      questionnaire: async () => undefined,
      premium: async () => undefined,
    }

    close()

    if (store.activeTab.value === tab) {
      await loaders[tab]()
      return
    }

    store.goTab(tab)
  }

  /**
   * Открыть чат мэтча из бокового меню.
   *
   * @param store стор свайпов из useSwipes
   * @param match мэтч с пользователем и комнатой
   */
  function openMatch(store: SwipesStore, match: SwipesMatch): void {
    close()
    store.openChat(match.user.id, match.conversation_id)
  }

  /**
   * Перейти в свой профиль.
   */
  function goProfile(): void {
    close()
    router.visit('/profile')
  }

  /**
   * Назад по истории, иначе в профиль.
   */
  function goBack(): void {
    close()
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }
    router.visit('/profile')
  }

  /**
   * Открыть фильтры из бокового меню.
   *
   * @param store стор свайпов из useSwipes
   */
  function openFilters(store: SwipesStore): void {
    close()
    store.showFilters.value = true
  }

  /**
   * Открыть помощь из бокового меню.
   *
   * @param store стор свайпов из useSwipes
   */
  function openHelp(store: SwipesStore): void {
    close()
    store.showHelp.value = true
  }

  return { isOpen, open, close, toggle, selectTab, openMatch, goBack, goProfile, openFilters, openHelp }
}
