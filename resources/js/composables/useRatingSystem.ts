import { computed } from 'vue'
import { useQuestStore } from '@/stores/quests'

/**
 * Таб «Система рейтинга»: каталог наград, недельный прогресс и шкала рангов.
 *
 * Все цифры едут из `/api/quests` (каталог — из `ActivityRewards::REWARDS`,
 * прогресс — из `weekly`), поэтому таб всегда синхронен с бэком:
 * поменял очки на сервере — описание обновилось само.
 * Компонент только отображает, вся выборка — здесь.
 *
 * @example
 * const rating = useRatingSystem()
 * await rating.refresh()
 */
export function useRatingSystem() {
  const store = useQuestStore()

  /** Каталог наград с бэка (код, очки, недельный кап, подпись). */
  const catalog = computed(() => store.state?.rating_catalog ?? [])

  /** Прогресс текущей недели: всего заработано + использование капов. */
  const weekly = computed(() => store.state?.weekly ?? null)

  /** Всего очков за неделю. */
  const weeklyTotal = computed(() => weekly.value?.total_earned ?? 0)

  /** Только действия с движением на неделе (для компактного списка). */
  const activeActions = computed(() => (weekly.value?.actions ?? []).filter((a) => a.used > 0))

  /** Шкала рангов из рейтинга (код, название, порог, достигнут). */
  const ranks = computed(() => (store.state?.rating?.ranks ?? []) as Array<{ code: string; name: string; icon: string; points: number; reached: boolean }>)

  /** Текущий счёт и следующий ранг. */
  const score = computed(() => Number(store.state?.rating?.score ?? 0))
  const next = computed(() => store.state?.rating?.next ?? null)

  /**
   * Процент использования недельного капа по действию.
   * @param used использовано
   * @param cap недельный кап
   */
  function capPercent(used: number, cap: number): number {
    if (cap <= 0) return 0
    return Math.min(100, Math.round((used / cap) * 100))
  }

  /**
   * Перечитать состояние с сервера (каталог, неделя, квесты, рейтинг).
   */
  async function refresh(): Promise<void> {
    await store.refresh()
  }

  return { store, catalog, weekly, weeklyTotal, activeActions, ranks, score, next, capPercent, refresh }
}
