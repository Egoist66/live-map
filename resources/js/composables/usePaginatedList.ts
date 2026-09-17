import { ref, type Ref } from 'vue'

/**
 * Ответ Laravel-пагинации.
 */
export interface LaravelPage<T> {
  data: T[]
  current_page: number
  last_page: number
  total?: number
}

/**
 * Загрузчик одной страницы Laravel-пагинации.
 *
 * @param page номер страницы (1-based)
 */
export type PageLoader<T, A = void> = (page: number, args?: A) => Promise<LaravelPage<T>>

/**
 * Универсальный менеджер постраничного списка для infinite scroll.
 *
 * Держит items/page/lastPage/loading/loadingMore/error, умеет reset + loadMore
 * с дедупом по id. Курсорные списки (чат по before) — через useChatHistory,
 * сюда только классический `?page=` (посты, комменты, люди, друзья, свайпы).
 *
 * @example
 * const feed = usePaginatedList({ loader: (p) => flowApi.feed({ page: p }) })
 * await feed.reset()
 * // sentinel -> feed.loadMore()
 *
 * @param options loader + getId для дедупа
 */
export function usePaginatedList<T>(options: {
  loader: PageLoader<T>
  getId?: (item: T) => number | string | null
}) {
  const items: Ref<T[]> = ref([])
  const page = ref(1)
  const lastPage = ref(1)
  const total = ref<number | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)

  const hasMore = ref(true)

  const getId = options.getId ?? ((item: T) => (item as { id?: number })?.id ?? null)

  /**
   * Слить новые ряды без дублей по id.
   *
   * @param prev текущие элементы
   * @param next новая страница
   */
  function mergeUnique(prev: T[], next: T[]): T[] {
    const seen = new Set<number | string>()
    const out: T[] = []

    for (const row of [...prev, ...next]) {
      const id = getId(row)

      if (id === null) {
        out.push(row)
        continue
      }

      if (seen.has(id)) {
        continue
      }

      seen.add(id)
      out.push(row)
    }

    return out
  }

  /**
   * Загрузить первую страницу заново.
   */
  async function reset(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const res = await options.loader(1)
      items.value = Array.isArray(res.data) ? res.data : []
      page.value = res.current_page ?? 1
      lastPage.value = res.last_page ?? 1
      total.value = typeof res.total === 'number' ? res.total : null
      hasMore.value = page.value < lastPage.value
    } catch (e) {
      error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не удалось загрузить'
    } finally {
      loading.value = false
    }
  }

  /**
   * Догрузить следующую страницу, если есть.
   *
   * @returns false когда страниц больше нет или идёт загрузка
   */
  async function loadMore(): Promise<boolean> {
    if (loading.value || loadingMore.value || !hasMore.value) {
      return false
    }

    loadingMore.value = true
    error.value = null

    try {
      const nextPage = page.value + 1
      const res = await options.loader(nextPage)
      const rows = Array.isArray(res.data) ? res.data : []
      items.value = mergeUnique(items.value, rows)
      page.value = res.current_page ?? nextPage
      lastPage.value = res.last_page ?? page.value
      total.value = typeof res.total === 'number' ? res.total : total.value
      hasMore.value = page.value < lastPage.value && rows.length > 0

      return rows.length > 0
    } catch (e) {
      error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не удалось догрузить'
      return false
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * Добавить элемент наверх (созданный пост/коммент).
   *
   * @param row новая сущность
   */
  function prepend(row: T): void {
    const id = getId(row)
    const without = id === null ? items.value : items.value.filter((item) => getId(item) !== id)
    items.value = [row, ...without]
  }

  /**
   * Убрать элемент из списка.
   *
   * @param id id сущности
   */
  function removeById(id: number | string): void {
    items.value = items.value.filter((item) => getId(item) !== id)
  }

  return {
    items,
    page,
    lastPage,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    reset,
    loadMore,
    prepend,
    removeById,
    mergeUnique,
  }
}
