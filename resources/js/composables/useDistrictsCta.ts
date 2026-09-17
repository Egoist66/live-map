import { router } from '@inertiajs/vue3'
import { route } from '@/route'

/**
 * Переход на страницу списка районов (витрина сообществ).
 *
 * @returns действие перехода на страницу районов
 * @example
 * const { goDistricts } = useDistrictsCta()
 * goDistricts()
 */
export function useDistrictsCta() {
  /**
   * Открывает страницу районов через Inertia-визит.
   */
  function goDistricts(): void {
    router.visit('/districts')
  }

  return { goDistricts }
}
