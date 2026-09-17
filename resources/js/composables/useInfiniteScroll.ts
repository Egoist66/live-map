import { ref, type Ref, onBeforeUnmount, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

/**
 * Бесконечная подгрузка через IntersectionObserver.
 *
 * Sentinel-элемент внизу (или вверху) списка триггерит `onLoadMore`,
 * когда появляется в зоне видимости. Дедуп, блокировка параллельных
 * запросов и остановка при `hasMore=false` — внутри.
 *
 * @example
 * const list = usePaginatedList(...)
 * const { sentinel } = useInfiniteScroll({
 *   hasMore: computed(() => list.hasMore.value),
 *   loading: computed(() => list.loadingMore.value),
 *   onLoadMore: () => list.loadMore(),
 * })
 * // <InfiniteSentinel :sentinel="sentinel" :has-more="..." :loading="..." />
 *
 * @param options hasMore/loading/onLoadMore + отступ rootMargin
 */
export function useInfiniteScroll(options: {
  hasMore: Ref<boolean>
  loading: Ref<boolean>
  disabled?: Ref<boolean>
  rootMargin?: string
  onLoadMore: () => Promise<unknown> | unknown
}) {
  const sentinel = ref<HTMLElement | null>(null)
  const locked = ref(false)

  const rootMargin = options.rootMargin ?? '320px 0px'

  async function maybeLoad(): Promise<void> {
    const hasMore = options.hasMore.value
    const loading = options.loading.value
    const disabled = options.disabled?.value ?? false

    if (!hasMore || loading || disabled || locked.value) {
      return
    }

    locked.value = true

    try {
      await options.onLoadMore()
    } finally {
      locked.value = false
    }
  }

  const { stop } = useIntersectionObserver(
    sentinel,
    ([entry]) => {
      if (entry?.isIntersecting) {
        void maybeLoad()
      }
    },
    { rootMargin },
  )

  onBeforeUnmount(() => {
    try {
      stop()
    } catch {
      /* noop */
    }
  })

  watch(
    sentinel,
    (el) => {
      if (!el) {
        return
      }

      try {
        const rect = el.getBoundingClientRect()
        const inView = rect.top < window.innerHeight + 400 && rect.bottom > -400

        if (inView) {
          void maybeLoad()
        }
      } catch {
        /* noop */
      }
    },
    { flush: 'post' },
  )

  return { sentinel, maybeLoad }
}
