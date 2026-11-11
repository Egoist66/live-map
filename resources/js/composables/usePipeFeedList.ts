import { computed, ref, watch } from 'vue'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'

/**
 * Списочная механика ленты Pipes: внутренний скролл-контейнер,
 * бесконечная догрузка по sentinel (тот же паттерн, что во всех
 * лентах приложения — Flow, Pipe/Show, чаты) и сброс скролла
 * наверх при смене вкладки/поиска/автора.
 *
 * Карточки рендерятся обычным v-for (DOM ограничен загруженными
 * страницами), скроллит нативный контейнер — VirtualScroller
 * PrimeVue в динамическом режиме с мутирующим списком ведёт себя
 * нестабильно: стоп-кадр из 3 карточек без скролла, потерянные
 * позиции после prepend/удаления.
 *
 * @example
 * const list = usePipeFeedList({ store: feed.store, hasMore: () => …, loadMore: () => … })
 * // <div :ref="list.scrollEl" class="pipe-feed-viewport overflow-y-auto">…</div>
 * // <InfiniteSentinel :sentinel="list.sentinel" … />
 *
 * @param store стор ленты (пагинация + ключ сброса скролла)
 * @param hasMore есть ли ещё страницы
 * @param loadMore догрузить следующую страницу
 */
export function usePipeFeedList(options: {
  store: {
    page: number
    lastPage: number
    loadingMore: boolean
    filter: unknown
    search: unknown
    authorId: number | null
  }
  hasMore: () => boolean
  loadMore: () => Promise<unknown> | unknown
}) {
  /** Скролл-контейнер ленты: нативный скролл внутри фиксированной высоты. */
  const scrollEl = ref<HTMLElement | null>(null)

  const { sentinel } = useInfiniteScroll({
    hasMore: computed(() => options.hasMore()),
    loading: computed(() => Boolean(options.store.loadingMore)),
    onLoadMore: () => options.loadMore(),
  })

  /**
   * Прокрутить ленту наверх (используется при смене
   * вкладки/поиска/автора — см. watch ниже).
   */
  function scrollToTop(): void {
    scrollEl.value?.scrollTo({ top: 0 })
  }

  /** Смена вкладки/поиска/автора — скролл уходит наверх. */
  watch(
    () => [options.store.filter, options.store.search, options.store.authorId],
    () => scrollToTop(),
  )

  return { scrollEl, sentinel, scrollToTop }
}
