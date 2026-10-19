import { computed, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'

/**
 * Виртуализация и догрузка списка Direct-диалогов.
 *
 * Отдаёт отфильтрованный список, фиксированную высоту строки для
 * PrimeVue VirtualScroller и обработчик lazy-load: следующая страница
 * запрашивается только когда viewport подошёл к концу списка.
 *
 * Матчи в общей ленте идут вперемешку с обычными чатами, поэтому одна
 * страница API может не добавить ни одного Direct-диалога. В этом случае
 * догружаем следующие страницы подряд, пока не появится новая строка
 * или не кончатся страницы — но не больше бюджета за один заход.
 * Без прокрутки бюджет не бесконечен, иначе пустой список выкачал бы
 * весь архив разом.
 *
 * @example
 * const direct = useChatDirectList({
 *   conversations: () => props.uloveConversations ?? [],
 *   filter: () => props.filter,
 *   hasMore: () => !!props.directHasMore,
 *   loading: () => !!props.directLoadingMore,
 *   loadMore: () => props.directLoadMore?.(!props.uloveOnly),
 * })
 * // <VirtualScroller :items="direct.items.value" :item-size="direct.itemSize.value"
 * //   lazy @scroll="direct.onScroll" @lazy-load="direct.onLazyLoad" />
 *
 * @param options геттеры диалогов, строки поиска, флагов загрузки и загрузчика страницы
 * @returns items, itemSize, onScroll, onLazyLoad, canLoadMoreManually, loadMoreManually
 */
export function useChatDirectList(options: {
  conversations: () => any[]
  filter: () => string
  hasMore: () => boolean
  loading: () => boolean
  loadMore: () => Promise<unknown> | unknown
}) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  /** Высота строки с нижней границей: 73px на мобилке, 69px на десктопе. */
  const itemSize = computed(() => (isDesktop.value ? 69 : 73))

  /** Сколько строк до конца считаем «уже у края» и просим следующую страницу. */
  const prefetchOffset = 6

  /** Сколько страниц можно догрузить подряд без прокрутки. */
  const autoFillPages = 4

  /** Остаток авто-догрузок до следующего пользовательского скролла. */
  const autoFillLeft = ref(autoFillPages)

  /** Одна авто-догрузка для пустого списка, чтобы не крутить все страницы. */
  const emptyAutoLoadDone = ref(false)

  /**
   * Direct-диалоги с учётом строки поиска по имени собеседника.
   */
  const items = computed(() => {
    const query = (options.filter() || '').trim().toLowerCase()
    const list = (options.conversations() || []).filter((conversation) => !!conversation)

    if (!query) {
      return list
    }

    return list.filter((conversation) => {
      const name = String(conversation?.other?.name ?? '').toLowerCase()
      return name.includes(query)
    })
  })

  /** Есть ли ещё страницы, но авто-догрузка уже исчерпана — показываем кнопку. */
  const canLoadMoreManually = computed(() => {
    if (!options.hasMore() || options.loading()) {
      return false
    }

    if (items.value.length === 0) {
      return emptyAutoLoadDone.value
    }

    return autoFillLeft.value <= 0
  })

  watch(
    () => items.value.length,
    (length) => {
      if (length > 0) {
        emptyAutoLoadDone.value = false
      }
    },
  )

  /**
   * Пользователь прокрутил список: возвращаем бюджет авто-догрузок.
   */
  function onScroll(): void {
    autoFillLeft.value = autoFillPages
  }

  /**
   * Догружать страницы, пока пользователь у края и есть бюджет.
   *
   * @param lastIndex последний отрисованный индекс
   */
  async function fillWhileNearEnd(lastIndex: number): Promise<void> {
    while (autoFillLeft.value > 0 && options.hasMore() && !options.loading()) {
      const total = items.value.length
      const isNearEnd = total === 0 || lastIndex >= total - prefetchOffset

      if (!isNearEnd) {
        return
      }

      autoFillLeft.value -= 1
      const before = items.value.length
      await options.loadMore()

      if (items.value.length > before) {
        return
      }
    }
  }

  /**
   * Запросить следующую страницу, если пользователь у конца списка.
   *
   * @param event диапазон отрисованных индексов от VirtualScroller
   */
  function onLazyLoad(event: { first: number; last: number }): void {
    if (!options.hasMore() || options.loading()) {
      return
    }

    if (items.value.length === 0) {
      if (emptyAutoLoadDone.value) {
        return
      }

      emptyAutoLoadDone.value = true
    }

    void fillWhileNearEnd(event.last)
  }

  /**
   * Ручная догрузка по кнопке: возвращает бюджет и просит следующую страницу.
   */
  function loadMoreManually(): void {
    if (!options.hasMore() || options.loading()) {
      return
    }

    emptyAutoLoadDone.value = false
    autoFillLeft.value = autoFillPages
    void fillWhileNearEnd(Number.MAX_SAFE_INTEGER)
  }

  return {
    items,
    itemSize,
    onScroll,
    onLazyLoad,
    canLoadMoreManually,
    loadMoreManually,
  }
}
