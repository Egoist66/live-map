import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useMotion } from '@/composables/useMotion'

export type PageTransitionPreset = 'fade-slide' | 'fade-blur' | 'slide' | 'scale' | 'auth' | 'none'

export interface UsePageTransitionOptions {
  preset?: PageTransitionPreset
}

/**
 * Состояние перехода между экранами Inertia.
 *
 * Ключ строится как `component:path` БЕЗ query/hash: иначе polling,
 * пагинация и валидационные ре-рендеры перезапускали бы Transition
 * посреди ввода в формы — а патч дерева в середине transition
 * и есть классический `insertBefore of null`.
 *
 * Режим `out-in` сознательно НЕ используется: пока старое дерево висит
 * в leave-фазе, vee-validate/PrimeVue-эффекты продолжают его патчить,
 * а Teleport/Portal внутри уже наполовину разобраны. Одновременный
 * кроссфейд (без mode) этого окна не создаёт — и анимация реально видна,
 * а не съедается исключением посреди transition. При включённой опции
 * «Отключить анимации» (`useMotion`) всегда возвращается `page-instant`.
 *
 * @param options пресет анимации
 * @returns ключ страницы, имя transition и helper сброса фокуса
 * @example
 * const { pageKey, transitionName, blurActiveElement } = usePageTransition()
 */
export function usePageTransition(options: UsePageTransitionOptions = {}) {
  const { preset = 'fade-slide' } = options
  const page = usePage()
  const { motionOff } = useMotion()

  const pageKey = computed(() => {
    const rawUrl = String(page.url || '')
    const path = rawUrl.split(/[?#]/)[0] || '/'

    return `${page.component}:${path}`
  })

  const transitionName = computed(() => {
    if (motionOff.value || preset === 'none') {
      return 'page-instant'
    }

    switch (preset) {
      case 'fade-blur':
        return 'page-fade-blur'
      case 'slide':
        return 'page-slide'
      case 'scale':
        return 'page-scale'
      case 'auth':
        return 'page-auth'
      default:
        return 'page-fade-slide'
    }
  })

  /**
   * Убирает фокус из покидаемого дерева перед leave-фазой.
   * Сфокусированный PrimeVue-инпут/Dropdown внутри удаляемого DOM —
   * частый триггер `insertBefore of null` при навигации.
   */
  function blurActiveElement(): void {
    if (typeof document === 'undefined') {
      return
    }

    const active = document.activeElement as HTMLElement | null
    const canBlur = !!active && typeof active.blur === 'function'

    if (canBlur) {
      active.blur()
    }
  }

  return {
    pageKey,
    transitionName,
    blurActiveElement,
  }
}
