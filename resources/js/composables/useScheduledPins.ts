import { computed, onUnmounted, ref } from 'vue'
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { pinsApi } from '@/services/pins.api'
import { busOn } from '@/services/realtime-bus'
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

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Отложенное обновление списка после realtime-события.
   * Схлопывает пачку тиков поллинга в один запрос.
   */
  async function scheduleRefresh(): Promise<void> {
    if (debounceTimer) return
    debounceTimer = setTimeout(() => {
      debounceTimer = null
    }, 2000)
    try {
      await refetch()
      await cache.invalidateQueries({ key: ['pins'] as any })
    } catch {}
  }

  /**
   * Реакция на публикацию/истечение: свой пин в upsert или свой id в deleted.
   * Один хендлер обслуживает оба транспорта — сокет зеркалится в шину
   * через useMap, поллер шлёт map:pins напрямую.
   * @param payload upsert/deleted/counters из шины
   */
  async function handleMapPins(payload: any): Promise<void> {
    const upsert = Array.isArray(payload?.upsert) ? payload.upsert : []
    const deleted = Array.isArray(payload?.deleted) ? payload.deleted : []
    const hasOwnUpsert = upsert.some((p: any) => p?.is_owner)
    if (hasOwnUpsert) {
      await scheduleRefresh()
      return
    }
    if (deleted.length === 0) return
    const mine = new Set(items.value.map((p: any) => Number(p?.id)))
    const touchesMine = deleted.some((id: unknown) => mine.has(Number(id)))
    if (touchesMine) {
      await scheduleRefresh()
    }
  }

  const offMapPins = busOn('map:pins', (payload: any) => {
    void handleMapPins(payload)
  })
  onUnmounted(() => {
    try { offMapPins() } catch {}
    if (debounceTimer) clearTimeout(debounceTimer)
  })

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
