import { computed, reactive } from 'vue'
import { datingApi, type DatingRatingSummary, type DatingReviewItem } from '@/services/dating.api'

/**
 * Состояние модалки «Кто меня оценил».
 */
export interface MyRatersState {
  /** модалка открыта */
  open: boolean
  /** грузим первую страницу */
  loading: boolean
  /** догружаем следующие */
  loadingMore: boolean
  /** текст ошибки */
  error: string | null
  /** true — нет Premium: имена скрыты, виден апсейл */
  locked: boolean
  /** сводка моего рейтинга */
  summary: DatingRatingSummary
  /** число отзывов по звёздам 1–5 */
  distribution: Record<number, number>
  /** авторы отзывов (пусто при locked) */
  raters: DatingReviewItem[]
  /** текущая страница */
  page: number
  /** последняя страница */
  lastPage: number
  /** всего отзывов */
  total: number
  /** первая загрузка уже была */
  loaded: boolean
}

const emptyDistribution = (): Record<number, number> => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })

/** Синглтон: кнопка в профиле и модалка делят одно состояние. */
const state = reactive<MyRatersState>({
  open: false,
  loading: false,
  loadingMore: false,
  error: null,
  locked: false,
  summary: { avg: null, count: 0, hidden: false },
  distribution: emptyDistribution(),
  raters: [],
  page: 1,
  lastPage: 1,
  total: 0,
  loaded: false,
})

/**
 * Кто меня оценил: сводка, раскладка по звёздам, авторы отзывов.
 *
 * Состояние живёт на уровне модуля — кнопка «Кто меня оценил» в профиле
 * и сама модалка работают с одним инстансом. Полный список авторов
 * отдаёт только Premium (админы/модераторы проходят гейт на бэке):
 * остальным — locked и обезличенная раскладка для апсейла.
 * Компоненты только отображают и зовут методы.
 *
 * @returns общее состояние и действия модалки
 * @example const raters = useMyRaters(); await raters.open()
 */
export function useMyRaters() {
  const hasMore = computed(() => state.page < state.lastPage)

  const maxBucket = computed(() => {
    const counts = [1, 2, 3, 4, 5].map((stars) => Number(state.distribution[stars] ?? 0))

    return Math.max(1, ...counts)
  })

  /**
   * Открыть модалку и подгрузить данные (повторно — из кеша состояния).
   */
  async function open(): Promise<void> {
    state.open = true

    if (!state.loaded && !state.loading) {
      await load()
    }
  }

  /**
   * Закрыть модалку.
   */
  function close(): void {
    state.open = false
  }

  /**
   * Загрузить первую страницу заново.
   */
  async function load(): Promise<void> {
    if (state.loading) {
      return
    }

    state.loading = true
    state.error = null

    try {
      const data = await datingApi.myRaters(1)
      applyPage(data, true)
      state.loaded = true
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      state.error = err.response?.data?.message ?? 'Не получилось загрузить оценки'
    } finally {
      state.loading = false
    }
  }

  /**
   * Догрузить следующую страницу авторов.
   */
  async function loadMore(): Promise<void> {
    if (state.loadingMore || !hasMore.value) {
      return
    }

    state.loadingMore = true

    try {
      const data = await datingApi.myRaters(state.page + 1)
      applyPage(data, false)
    } catch {
      // Тихая неудача: список уже виден, тост не нужен.
    } finally {
      state.loadingMore = false
    }
  }

  /**
   * Вшить страницу ответа в состояние (дедуп по id отзыва).
   *
   * @param data ответ /api/dating/my-raters
   * @param replace заменить список (первая страница) или дописать
   */
  function applyPage(data: Awaited<ReturnType<typeof datingApi.myRaters>>, replace: boolean): void {
    state.locked = !!data.locked
    state.summary = data.summary
    state.distribution = { ...emptyDistribution(), ...(data.distribution ?? {}) }

    const incoming = Array.isArray(data.raters) ? data.raters : []

    if (replace) {
      state.raters = incoming
    } else {
      const known = new Set(state.raters.map((item) => item.id))

      for (const item of incoming) {
        if (!known.has(item.id)) {
          state.raters.push(item)
          known.add(item.id)
        }
      }
    }

    state.page = data.meta.current_page
    state.lastPage = data.meta.last_page
    state.total = data.meta.total
  }

  return { state, hasMore, maxBucket, open, close, load, loadMore }
}
