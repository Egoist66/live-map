import { computed, ref, onMounted } from 'vue'
import { usePage } from '@inertiajs/vue3'

export type PageTransitionPreset = 'fade-slide' | 'fade-blur' | 'slide' | 'scale'

export interface UsePageTransitionOptions {
  preset?: PageTransitionPreset
  duration?: number
}

export function usePageTransition(options: UsePageTransitionOptions = {}) {
  const { preset = 'fade-slide' } = options
  const page = usePage()
  const prefersReduced = ref(false)

  onMounted(() => {
    prefersReduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  const pageKey = computed(() => `${page.component}:${page.url}`)

  const transitionName = computed(() => {
    if (prefersReduced.value) return 'page-instant'
    switch (preset) {
      case 'fade-blur': return 'page-fade-blur'
      case 'slide': return 'page-slide'
      case 'scale': return 'page-scale'
      default: return 'page-fade-slide'
    }
  })

  const transitionMode = 'out-in' as const
  const transitionAppear = true

  return {
    pageKey,
    transitionName,
    transitionMode,
    transitionAppear,
    prefersReduced,
  }
}
