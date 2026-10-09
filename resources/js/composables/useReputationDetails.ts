import { computed, ref } from 'vue'
import { useMyRating } from '@/composables/useMyRating'
import { useMyTrust } from '@/composables/useMyTrust'

/**
 * Зона шкалы репутации 1–10 (зеркалит TrustScoreService::ZONES на бэке).
 */
export interface ReputationZone {
  /** Нижняя граница зоны. */
  min: number
  /** Верхняя граница зоны. */
  max: number
  /** Подпись зоны. */
  label: string
}

/**
 * Сведения о репутации для диалога в профиле: скор, шкала 1–10,
 * звёзды отзывов, что влияет на балл и как обжаловать.
 *
 * Данные тянут useMyTrust (скор/зона) и useMyRating (звёзды),
 * компонент только отображает и зовёт open/close. Диалог один
 * на страницу: состояние открыто/закрыто живёт здесь.
 *
 * @returns состояние диалога, данные и ссылки на FAQ/поддержку
 * @example
 * ```ts
 * const details = useReputationDetails()
 * details.open()
 * ```
 */
export function useReputationDetails() {
  const isOpen = ref(false)
  const trust = useMyTrust()
  const rating = useMyRating()

  const zones: ReputationZone[] = [
    { min: 1, max: 2, label: 'Плохо' },
    { min: 3, max: 4, label: 'Подозрительно' },
    { min: 5, max: 6, label: 'Спорно' },
    { min: 7, max: 8, label: 'Хорошо' },
    { min: 9, max: 10, label: 'Отлично' },
  ]

  /** Текущий скор 1–10 (null пока грузится). */
  const score = computed(() => trust.score.value)

  /** Зона текущего скора для подсветки в шкале. */
  const currentZone = computed(() => {
    const value = score.value

    if (value == null) {
      return null
    }

    return zones.find((zone) => value >= zone.min && value <= zone.max) ?? null
  })

  /** Что роняет и возвращает балл — строки для списка в диалоге. */
  const factors = computed(() => [
    'Жалоба на вас — минус 1 (кнопка «Пожаловаться» есть в каждом чате)',
    'Блокировка вас другим человеком — минус 1',
    'Низкая оценка 1–2 в отзыве — минус 1',
    'Жалобу признали необоснованной — балл вернётся сам',
    'Pro и Premium сразу возвращают идеальные 10',
  ])

  /** Диплинк в FAQ на раздел «Репутация». */
  const faqHref = '/faq#faq-reputation'

  /** Куда писать обжалование: поддержка внутри настроек. */
  const appealHint = 'Настройки → Поддержка · тема «Обжалование репутации»'

  function openDialog(): void {
    isOpen.value = true
  }

  function closeDialog(): void {
    isOpen.value = false
  }

  return {
    isOpen,
    trust,
    rating,
    zones,
    score,
    currentZone,
    factors,
    faqHref,
    appealHint,
    open: openDialog,
    close: closeDialog,
  }
}
