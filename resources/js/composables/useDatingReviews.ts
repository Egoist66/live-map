import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { datingApi, type DatingRatingSummary, type DatingReviewItem, type DatingReviewStatus } from '@/services/dating.api'
import { useContentModeration } from '@/composables/useContentModeration'
import { busOn } from '@/services/realtime-bus'

/**
 * Отзывы о пользователе знакомств: сводка, список, форма оценки.
 *
 * Секция свёрнута по умолчанию: список грузится только при первом
 * раскрытии (ленивая загрузка) — заходим в профиль, не дёргая API
 * зря. Сводка приходит с карточки (seed) и видна даже свёрнутой.
 * Один инстанс — один человек: сводка и право оценить грузятся
 * вместе со списком, отправка обновляет сводку из ответа без
 * перезагрузки. Звёзды ставятся один раз: у кого отзыв уже есть,
 * тот меняет только текст — новую оценку поверх примут лишь
 * от админа. Отзыв всегда с текстом: минимум BODY_MIN символов,
 * иначе бэк вернёт 422. Пока статус pending, отзыв не виден ни в
 * списке, ни в сводке — автору показываем «на модерации». Низкие
 * оценки идут в ручную очередь, 4–5★ от трастовых публикуются
 * сразу — вердикт долетает автору realtime-событием review.moderated
 * (сокет + polling-зеркало) и здесь обновляет статус без
 * перезагрузки. Право оценить (can_review) — гейт на бэке:
 * только после осмысленной переписки; причина запрета приходит
 * в can_review_reason и показывается подсказкой вместо формы.
 * Компоненты только отображают и зовут методы.
 */

/** Минимум текста отзыва, символов: должен совпадать с бэкендом. */
export const REVIEW_BODY_MIN = 50

/** Максимум текста отзыва, символов: должен совпадать с бэкендом. */
export const REVIEW_BODY_MAX = 280

/**
 * @param targetId id человека, о котором отзывы
 * @returns состояние отзывов и действия
 * @example const reviews = useDatingReviews(() => card.id); reviews.toggle()
 */
export function useDatingReviews(targetId: () => number | null) {
  const summary = ref<DatingRatingSummary>({ avg: null, count: 0, hidden: false })
  const canReview = ref(false)
  /** Почему бэк запретил оценивать: подсказка вместо формы. */
  const canReviewReason = ref<string | null>(null)
  const myReview = ref<DatingReviewItem | null>(null)
  const items = ref<DatingReviewItem[]>([])
  const page = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  /** Секция развёрнута: список виден только в раскрытом виде. */
  const expanded = ref(false)
  /** Первая загрузка уже прошла: повторно не дёргаем API. */
  const loaded = ref(false)

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

  /** Мой отзыв ещё на модерации: показываем «на модерации» вместо публикации. */
  const myReviewStatus = computed<DatingReviewStatus | null>(() => myReview.value?.status ?? null)
  const myReviewOnModeration = computed(() => myReview.value?.status === 'pending')

  /**
   * Развернуть секцию и при первом раскрытии загрузить отзывы.
   */
  async function expand(): Promise<void> {
    expanded.value = true

    if (!loaded.value && !loading.value) {
      await load()
    }
  }

  /**
   * Свернуть секцию: данные остаются в памяти.
   */
  function collapse(): void {
    expanded.value = false
  }

  /**
   * Переключить свёрнутость секции.
   */
  function toggle(): void {
    if (expanded.value) {
      collapse()
    } else {
      void expand()
    }
  }

  /**
   * Сбросить состояние под нового человека: секция снова свёрнута.
   */
  function reset(): void {
    summary.value = { avg: null, count: 0, hidden: false }
    canReview.value = false
    canReviewReason.value = null
    myReview.value = null
    items.value = []
    page.value = 1
    lastPage.value = 1
    total.value = 0
    error.value = null
    expanded.value = false
    loaded.value = false
  }

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
      canReviewReason.value = data.can_review_reason ?? null
      myReview.value = data.my_review
      items.value = Array.isArray(data.reviews) ? data.reviews : []
      page.value = data.meta.current_page
      lastPage.value = data.meta.last_page
      total.value = data.meta.total
      loaded.value = true
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
   * Текст обязателен: минимум REVIEW_BODY_MIN символов — голые
   * оценки не публикуем, бэк всё равно вернёт 422. Модерацию
   * пропускаем фронтово тоже только по модерируемым словам.
   * Звёзды заморожены: при starsLocked слать rating не нужно —
   * бэк всё равно оставит старую оценку, а чужую поверх
   * примет лишь от админа.
   *
   * @param rating звёзды 1–5 или null (только текст)
   * @param body текст от REVIEW_BODY_MIN до REVIEW_BODY_MAX символов
   */
  async function save(rating: number | null, body: string | null): Promise<void> {
    const id = targetId()

    if (!id || saving.value) {
      return
    }

    const text = (body ?? '').trim()

    if (text.length < REVIEW_BODY_MIN) {
      const shortfall = `Напиши подробнее: минимум ${REVIEW_BODY_MIN} символов (сейчас ${text.length})`
      error.value = shortfall
      throw new Error(shortfall)
    }

    const blockReason = useContentModeration().assertPublishable(text)

    if (blockReason) {
      error.value = blockReason
      throw new Error(blockReason)
    }

    saving.value = true
    error.value = null

    try {
      const data = await datingApi.saveReview(id, rating, text)
      myReview.value = data.review
      summary.value = data.summary
      total.value = data.summary.count
      loaded.value = true

      // На модерации отзыв нигде не виден: в список не добавляем —
      // после одобрения подтянется перезагрузкой списка.
      if (data.review.status !== 'pending') {
        const index = items.value.findIndex((item) => item.id === data.review.id)

        if (index === -1) {
          items.value.unshift(data.review)
        } else {
          items.value[index] = data.review
        }
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

  /** Мой отзыв отклонён: показываем «отклонён» вместо «на модерации». */
  const myReviewRejected = computed(() => myReview.value?.status === 'rejected')

  /** Подписка realtime-вердикта уже оформлена: повторно не вешаем. */
  let busBound = false
  /** Функция отписки от realtime-вердикта. */
  let busUnbind: (() => void) | null = null

  /**
   * Realtime-вердикт моего отзыва: review.moderated от модератора.
   *
   * Событие приходит через notification.created (сокет и polling-
   * зеркало эмитят одно и то же — дедуп по статусу: если статус уже
   * тот же, перезагрузку не делаем). Чужие отзывы и другие люди
   * игнорируются.
   *
   * @param event событие шины: { notification: { type, data: { review } } }
   */
  function handleModerationVerdict(event: { notification?: { type?: string; data?: { review?: DatingReviewItem } } }): void {
    const notification = event?.notification

    if (notification?.type !== 'review.moderated') {
      return
    }

    const review = notification.data?.review

    if (!review) {
      return
    }

    const currentId = targetId()
    const meId = Number(
      (usePage().props as unknown as { auth?: { user?: { id?: number } | null } }).auth?.user?.id ?? NaN,
    )

    if (
      currentId === null
      || Number(review.target_id) !== Number(currentId)
      || Number(review.author_id) !== meId
    ) {
      return
    }

    const previousStatus: DatingReviewStatus | null = myReview.value?.status ?? null

    if (previousStatus === review.status) {
      return
    }

    myReview.value = review

    // Сводка и список могли измениться (появился/исчез мой отзыв) —
    // тихо перечитываем состояние с бэка.
    void load()
  }

  /**
   * Подписаться на realtime-вердикты (idempotent).
   */
  function bindRealtime(): void {
    if (busBound) {
      return
    }

    busBound = true
    busUnbind = busOn('user:notification.created', handleModerationVerdict)
  }

  onMounted(() => {
    bindRealtime()
  })

  onBeforeUnmount(() => {
    busUnbind?.()
    busUnbind = null
    busBound = false
  })

  return {
    summary,
    canReview,
    canReviewReason,
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
    myReviewStatus,
    myReviewOnModeration,
    myReviewRejected,
    expanded,
    loaded,
    load,
    loadMore,
    expand,
    collapse,
    toggle,
    reset,
    save,
    remove,
  }
}
