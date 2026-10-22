import { computed } from 'vue'
import { SIGNUP_GOALS } from '@/composables/useSignupGoals'

/**
 * Данные блока регистрации ULove: цели знакомств и текст геолокации.
 *
 * Геолокация нужна только для точности расстояния в свайпах;
 * отказ оставляет в карточке город и страну.
 *
 * @returns цели регистрации и тексты блока места
 * @example const reg = useRegisterVisibility()
 */
export function useRegisterVisibility() {
  /** Все цели знакомств. */
  const goalOptions = computed(() => [...SIGNUP_GOALS])

  /** Заголовок необязательного блока геолокации. */
  const locationTitle = computed(() => 'Моё место')

  /** Подсказка: зачем ULove нужна геолокация. */
  const locationHint = computed(
    () => 'Для точности расстояния в свайпах. Пропустишь — в карточке будут только город и страна.',
  )

  /** Текст загрузки адреса после геолокации. */
  const addressLoadingText = computed(() => 'Определяем адрес…')

  return { goalOptions, locationTitle, locationHint, addressLoadingText }
}
