import { computed, ref } from 'vue'
import axios from 'axios'
import { useQuery, useMutation, useQueryCache } from '@pinia/colada'
import { myPinsQuery, PIN_KEYS } from '@/queries/pins'
import { pinsApi } from '@/services/pins.api'

export function useMyPinsSettings(active: any) {
  const cache = useQueryCache()
  const { state: pinsState, refetch, asyncStatus: pinsAsyncStatus } = useQuery(() => ({ ...myPinsQuery, enabled: active.value === 'pins' }))
  const myPins = computed(() => (pinsState.value.data as any[]) || [])
  const loadingPins = computed(() => pinsState.value.status === 'pending' || (pinsAsyncStatus.value as any) === 'loading')
  const { mutateAsync: deleteMutate, asyncStatus: deleteAsyncStatus } = useMutation({
    mutation: (id: number) => pinsApi.remove(id),
    onSuccess: () => cache.invalidateQueries({ key: PIN_KEYS.mine() as any }),
  })
  async function deleteMyPin(id: number) {
    if (!confirm('Удалить пин?')) return
    try { await deleteMutate(id); await refetch() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }
  return { myPins, loadingPins, deleteAsyncStatus, deleteMyPin, refetch }
}

export function useBillingInfo() {
  const zoneCount = ref(0)
  async function loadZoneCount() {
    try { const { data } = await axios.get('/api/zone-subscriptions'); zoneCount.value = Array.isArray(data) ? data.length : 0 } catch {}
  }
  return { zoneCount, loadZoneCount }
}
