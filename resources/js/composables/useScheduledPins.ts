import { computed, ref } from 'vue'
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { pinsApi } from '@/services/pins.api'
import { defineQueryOptions } from '@pinia/colada'

export const scheduledPinsQuery = defineQueryOptions({
  key: ['pins', 'scheduled'] as const,
  query: () => pinsApi.scheduled(),
  staleTime: 30_000,
})

export function isScheduledPin(p: any): boolean {
  return !!p && (p.status === 'scheduled' || !!p.is_scheduled)
}

export function formatScheduleCountdown(publishAt: string | null | undefined, now = Date.now()): string {
  if (!publishAt) return ''
  const diff = new Date(publishAt).getTime() - now
  if (diff <= 0) return 'скоро'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `через ${m} мин`
  const h = Math.floor(m / 60)
  if (h < 24) return `через ${h} ч`
  const d = Math.floor(h / 24)
  return `через ${d} дн`
}

export function formatScheduleDate(publishAt: string | null | undefined): string {
  if (!publishAt) return ''
  return new Date(publishAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function useScheduledPins() {
  const cache = useQueryCache()
  const { state, refetch, asyncStatus } = useQuery(() => ({ ...scheduledPinsQuery }))
  const items = computed(() => ((state.value.data as any[]) || []).slice().sort((a, b) => +new Date(a.publish_at) - +new Date(b.publish_at)))
  const loading = computed(() => state.value.status === 'pending' || (asyncStatus.value as any) === 'loading')
  const deletingId = ref<number | null>(null)

  const { mutateAsync: removeAsync } = useMutation({
    mutation: (id: number) => pinsApi.remove(id),
    onSuccess: () => cache.invalidateQueries({ key: ['pins'] as any }),
  })

  async function cancel(id: number): Promise<void> {
    deletingId.value = id
    try {
      await removeAsync(id)
      await refetch()
    } finally {
      deletingId.value = null
    }
  }

  return { items, loading, deletingId, refetch, cancel, isScheduledPin, formatScheduleCountdown, formatScheduleDate }
}
