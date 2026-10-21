import { ref } from 'vue'
import { busOn } from '@/services/realtime-bus'
import { notificationsApi } from '@/services/notifications.api'

/**
 * Данные об удалённом модератором отзыве из inbox-строки review.deleted.
 */
export interface ReviewDeletedAlert {
  reviewId: number
  rating: number
  /** Объяснение модератора: обязательно на бэке. */
  reason: string
  authorName: string | null
  targetName: string | null
}

/** Модалка уже открыта — повторные события не наслаиваются. */
const open = ref(false)
const alert = ref<ReviewDeletedAlert | null>(null)
/** Id inbox-строки: при «Понятно» помечаем её прочитанной. */
const notificationId = ref<string | null>(null)

/** Обработанные id inbox-строк: сокет и поллер несут одно и то же. */
const seenIds = new Set<string>()

let busBound = false

/**
 * Модалка «Отзыв удалён модератором» для автора отзыва.
 *
 * Персонал удалил твой отзыв — ты должен понять почему, а не
 * гадать. Открывается сама по realtime-событию
 * user:notification.created с типом review.deleted (сокет и
 * polling-зеркало несут одну строку — дедуп по id inbox-строки).
 * Текст объяснения обязателен на бэке, рядом — дисклеймер, что
 * письмо с объяснением ушло и на почту. Компонент только рисует.
 *
 * @example
 * ```ts
 * // в корневом лейауте один раз:
 * useReviewDeletedAlert()
 * // <ReviewDeletedAlertDialog />
 * ```
 *
 * @returns состояние модалки и действия
 */
export function useReviewDeletedAlert() {
  ensureBusSync()

  /**
   * Открыть модалку с готовым пейлоадом (для тестов и ручных вызовов).
   *
   * @param payload данные об удалённом отзыве
   * @param notifId id inbox-строки для автопрочтения по «Понятно»
   */
  function openAlert(payload: ReviewDeletedAlert, notifId: string | null): void {
    alert.value = payload
    notificationId.value = notifId
    open.value = true
  }

  /**
   * Закрыть модалку и пометить строку колокольчика прочитанной:
   * объяснение уже прочитано — незачем держать бейдж.
   */
  async function acknowledge(): Promise<void> {
    open.value = false

    const id = notificationId.value

    if (!id) {
      return
    }

    try {
      await notificationsApi.markRead([id])
    } catch {
      // Не критично: строка останется непрочитанной в колокольчике.
    }
  }

  return { open, alert, acknowledge }
}

/**
 * Разово (модульный state) подписаться на прилетающие алерты
 * удаления отзыва. При переполнении дедуп-кэша сбрасываем —
 * вероятных повторов к этому моменту давно нет.
 */
function ensureBusSync(): void {
  if (busBound) {
    return
  }

  busBound = true

  try {
    busOn('user:notification.created', (e: unknown) => {
      const row = (e as { notification?: Record<string, unknown> | null })?.notification

      if (!row || row.type !== 'review.deleted') {
        return
      }

      const rowId = typeof row.id === 'string' ? row.id : null

      if (rowId && seenIds.has(rowId)) {
        return
      }

      if (rowId) {
        if (seenIds.size >= 200) {
          seenIds.clear()
        }

        seenIds.add(rowId)
      }

      const data = (row.data ?? {}) as { review?: Record<string, unknown> | null; reason?: string | null }
      const review = data.review
      const reviewId = Number(review?.id ?? 0)

      if (reviewId <= 0) {
        return
      }

      alert.value = {
        reviewId,
        rating: Number(review?.rating ?? 0),
        reason: String(data.reason || 'Объяснение от модерации'),
        authorName: typeof review?.author_name === 'string' ? review.author_name : null,
        targetName: typeof review?.target_name === 'string' ? review.target_name : null,
      }
      notificationId.value = rowId
      open.value = true
    })
  } catch {
    busBound = false
  }
}
