import { computed, type Ref } from 'vue'
import type { SwipeCard } from '@/services/dating.api'

/**
 * Предупреждение о низкой репутации в свайпах.
 *
 * Показывает жёлтый баннер в модалке анкеты, когда у человека
 * низкая репутация (траст 1–4) или низкий средний балл отзывов (< 3).
 * Числа показываем честно, за деталями ведём в FAQ.
 *
 * @param card анкета из колоды свайпов (может отсутствовать)
 * @returns флаг показа, подпись зоны, строка чисел и ссылка на FAQ
 * @example const warn = useSwipeTrustWarning(computed(() => card))
 */
export function useSwipeTrustWarning(card: Ref<SwipeCard | null>) {
  const trustScore = computed(() => {
    const raw = card.value?.trust_score

    if (raw == null) {
      return null
    }

    const score = Math.round(Number(raw))

    if (!Number.isFinite(score)) {
      return null
    }

    return Math.min(10, Math.max(1, score))
  })

  const ratingAvg = computed(() => card.value?.rating_avg ?? null)
  const ratingCount = computed(() => card.value?.rating_count ?? 0)
  const ratingHidden = computed(() => card.value?.rating_hidden ?? false)

  const isLowTrust = computed(() => trustScore.value != null && trustScore.value <= 4)

  const isLowRating = computed(() => {
    const avg = ratingAvg.value
    const count = ratingCount.value

    if (ratingHidden.value || avg == null || count <= 0) {
      return false
    }

    return avg < 3
  })

  const show = computed(() => isLowTrust.value || isLowRating.value)

  const trustLabel = computed(() => {
    const score = trustScore.value

    if (score == null) {
      return ''
    }

    if (score <= 2) {
      return 'Плохо'
    }

    if (score <= 4) {
      return 'Подозрительный'
    }

    if (score <= 6) {
      return 'Спорно'
    }

    if (score <= 8) {
      return 'Хорошо'
    }

    return 'Отлично'
  })

  const numbersLine = computed(() => {
    const parts: string[] = []
    const score = trustScore.value

    if (score != null) {
      const label = trustLabel.value
      const suffix = label ? ` · ${label}` : ''
      parts.push(`Репутация ${score} из 10${suffix}`)
    }

    const avg = ratingAvg.value
    const count = ratingCount.value

    if (!ratingHidden.value && avg != null && count > 0) {
      parts.push(`★ ${avg} (${count})`)
    }

    return parts.join(' · ')
  })

  const faqHref = '/faq#faq-reputation'

  return { show, isLowTrust, isLowRating, trustScore, trustLabel, numbersLine, faqHref }
}
