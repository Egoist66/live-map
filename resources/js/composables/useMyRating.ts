import { computed, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useDatingReviews } from '@/composables/useDatingReviews'

/**
 * Мой рейтинг для настроек профиля: среднее всех поставленных звёзд.
 *
 * Среднее считает бэк (AVG по всем отзывам), фронт только показывает:
 * звёзды, число оценок и пометку о PRO-скрытии. Компонент лишь
 * отображает и зовёт reload.
 *
 * @returns сводка моего рейтинга и перезагрузка
 * @example const rating = useMyRating()
 */
export function useMyRating() {
  const page = usePage()

  const myId = computed<number | null>(() => {
    try {
      const raw = (page.props as unknown as { auth?: { user?: { id?: unknown } | null } }).auth?.user?.id
      const id = Number(raw)

      return Number.isFinite(id) && id > 0 ? id : null
    } catch {
      return null
    }
  })

  const reviews = useDatingReviews(() => myId.value)

  try {
    watch(
      myId,
      (id) => {
        if (id) {
          void reviews.load()
        }
      },
      { immediate: true },
    )
  } catch {
    // No-op: без реактивности карточка останется пустой.
  }

  /** Есть ли хоть одна оценка. */
  const hasRatings = computed(() => reviews.count.value > 0)

  /** Скрыт ли мой рейтинг от других (PRO). */
  const isHidden = computed(() => reviews.summary.value.hidden)

  return {
    average: reviews.average,
    count: reviews.count,
    loading: reviews.loading,
    error: reviews.error,
    hasRatings,
    isHidden,
    reload: reviews.load,
  }
}
