import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { datingApi, type DatingRatingSummary, type DatingReviewItem } from '@/services/dating.api'
import { useContentModeration } from '@/composables/useContentModeration'

/**
 * Отзывы о пользователе знакомств: сводка, список, форма оценки.
 *
 * Один инстанс — один человек: сводка и право оценить грузятся
 * вместе со списком, отправка обновляет сводку из ответа без
 * перезагрузки. Звёзды ставятся один раз: у кого отзыв уже есть,
 * тот меняет только текст — новую оценку поверх примут лишь
 * от админа. Компоненты только отображают и зовут методы.
 *
 * @param targetId id человека, о котором отзывы
 * @returns состояние отзывов и действия
 * @example const reviews = useDatingReviews(() => card.id); await reviews.load()
 */
export function useDatingReviews(targetId: () => number | null) {
  const summary = ref<DatingRatingSummary>({ avg: null, count: 0, hidden: false })
  const canReview = ref(false)
  const myReview = ref<DatingReviewItem | null>(null)
  const items = ref<DatingReviewItem[]>([])
  const page = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const hasMore = computed(() => page.value < lastPage.value)
  const visible = computed(() => !summary.value.hidden)
  const average = computed(() => summary.value.avg)
  const count = computed(() => summary.value.count)

  /** Я админ: мне можно менять звёзды и удалять свой отзыв. */
  const isAdmin = computed(() => {
    try {
      const user = (usePage().props as unknown as { auth?: { user?: { is_admin?: boolean; role?: string } | null } }).auth?.user

      return !!user?.is_admin || user?.role === 'admin'
    } catch {
      return false
    }
  })

  /** Звёзды уже поставлены и я не админ: правится только текст. */
  const starsLocked = computed(() => myReview.value !== null && !isAdmin.value)

  /**
   * Загрузить первую страницу отзывов и сводку.
   */
  async function load(): Promise<void> {
    const id = targetId()

    if (!id) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = await datingApi.reviews(id, 1)
      summary.value = data.summary
      canReview.value = data.can_review
      myReview.value = data.my_review
      items.value = Array.isArray(data.reviews) ? data.reviews : []
      page.value = data.meta.current_page
      lastPage.value = data.meta.last_page
      total.value = data.meta.total
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } }

      if (err.response?.status !== 403) {
        error.value = err.response?.data?.message ?? 'Не получилось загрузить отзывы'
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * Догрузить следующую страницу отзывов.
   */
  async function loadMore(): Promise<void> {
    const id = targetId()

    if (!id || loadingMore.value || !hasMore.value) {
      return
    }

    loadingMore.value = true

    try {
      const data = await datingApi.reviews(id, page.value + 1)
      const known = new Set(items.value.map((item) => item.id))

      for (const item of data.reviews) {
        if (!known.has(item.id)) {
          items.value.push(item)
          known.add(item.id)
        }
      }

      page.value = data.meta.current_page
      lastPage.value = data.meta.last_page
    } catch {
    } finally {
      loadingMore.value = false
    }
  }

  /**
   * Оставить отзыв или поправить текст своего.
   *
   * Звёзды заморожены: при starsLocked слать rating не нужно —
   * бэк всё равно оставит старую оценку, а чужую поверх
   * примет лишь от админа.
   *
   * @param rating звёзды 1–5 или null (только текст)
   * @param body текст или null
   */
  async function save(rating: number | null, body: string | null): Promise<void> {
    const id = targetId()

    if (!id || saving.value) {
      return
    }

    if (body !== null && body.trim() !== '') {
      const blockReason = useContentModeration().assertPublishable(body)

      if (blockReason) {
        error.value = blockReason
        throw new Error(blockReason)
      }
    }

    saving.value = true
    error.value = null

    try {
      const data = await datingApi.saveReview(id, rating, body)
      myReview.value = data.review
      summary.value = data.summary
      total.value = data.summary.count

      const index = items.value.findIndex((item) => item.id === data.review.id)

      if (index === -1) {
        items.value.unshift(data.review)
      } else {
        items.value[index] = data.review
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не получилось сохранить отзыв'
      throw e
    } finally {
      saving.value = false
    }
  }

  /**
   * Удалить свой отзыв.
   */
  async function remove(): Promise<void> {
    const id = targetId()

    if (!id || !myReview.value || saving.value) {
      return
    }

    saving.value = true
    error.value = null

    try {
      await datingApi.deleteReview(id)
      items.value = items.value.filter((item) => item.id !== myReview.value?.id)
      myReview.value = null
      total.value = Math.max(0, total.value - 1)
      summary.value = { ...summary.value, count: total.value }

      if (total.value === 0) {
        summary.value = { ...summary.value, avg: null }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не получилось удалить отзыв'
      throw e
    } finally {
      saving.value = false
    }
  }

  return {
    summary,
    canReview,
    myReview,
    items,
    total,
    loading,
    loadingMore,
    saving,
    error,
    hasMore,
    visible,
    average,
    count,
    isAdmin,
    starsLocked,
    load,
    loadMore,
    save,
    remove,
  }
}
