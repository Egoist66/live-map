import { router } from '@inertiajs/vue3'

/**
 * Переход на страницу списка районов (витрина сообществ).
 *
 * URL берётся из Ziggy по имени маршрута `districts.index`,
 * при недоступности Ziggy используется прямой путь `/districts`.
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
    let target = '/districts'

    try {
      target = route('districts.index')
    } catch {
      target = '/districts'
    }

    router.visit(target)
  }

  return { goDistricts }
}
