import { computed } from 'vue'

/**
 * Названия рангов, иконки и прогресс до следующего.
 * @param rating объект rating из /api/quests
 * @returns подписи ранга и шкала
 * @example
 * const r = useRank(store.rating)
 */
export function useRank(rating: any) {
  const score = computed(() => Number(rating?.value?.score ?? rating?.score ?? 0))
  const level = computed(() => String(rating?.value?.level ?? rating?.level ?? 'novice'))
  const levelName = computed(() => String(rating?.value?.level_name ?? rating?.level_name ?? level.value))
  const levelIcon = computed(() => String(rating?.value?.level_icon ?? rating?.level_icon ?? 'pi pi-sparkles'))
  const next = computed(() => rating?.value?.next ?? rating?.next ?? null)
  const ranks = computed(() => (rating?.value?.ranks ?? rating?.ranks ?? []) as any[])

  const nextLabel = computed(() => {
    const n = next.value
    if (!n?.code) return 'Максимальный ранг'
    return `До «${n.name}»: ещё ${n.needed} очков`
  })

  return { score, level, levelName, levelIcon, next, ranks, nextLabel }
}
