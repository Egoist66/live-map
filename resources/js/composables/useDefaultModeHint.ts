import { ref } from 'vue'
import { usePage } from '@inertiajs/vue3'

const HINT_KEY = 'upin_default_mode_hint_dismissed'

const dismissed = ref(false)

try {
  dismissed.value = typeof window !== 'undefined' && !!window.localStorage.getItem(HINT_KEY)
} catch {
  dismissed.value = false
}

/**
 * Ненавязчивая подсказка о второй стороне приложения.
 *
 * UPin-пользователям на карте намекает про ULove и наоборот.
 * Скрытие запоминается локально, режим при этом не меняется.
 *
 * @returns флаг показа подсказки и действие скрытия
 * @example const hint = useDefaultModeHint()
 */
export function useDefaultModeHint() {
  const page = usePage()

  function dismiss(): void {
    dismissed.value = true
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HINT_KEY, '1')
      }
    } catch {
    }
  }

  function reset(): void {
    dismissed.value = false
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(HINT_KEY)
      }
    } catch {
    }
  }

  return { dismissed, dismiss, reset }
}
