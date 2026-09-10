import { router } from '@inertiajs/vue3'

/**
 * Переход на свайпы из промо-блока «Начать знакомиться».
 * @returns действие перехода на страницу знакомств
 */
export function useSwipesCta() {
  /**
   * Редиректит на страницу свайпов.
   */
  function goSwipes(): void {
    router.visit('/swipes')
  }

  return { goSwipes }
}
