import { defineStore } from 'pinia'
import { ref } from 'vue'
import { pinsApi } from '@/services/pins.api'
import { isPinAlive } from '@/composables/usePinExpiry'
import type { Pin, CreatePinPayload, UpdatePinPayload, BoostType } from '@/types/entities/Pin'

export const usePinsStore = defineStore('pins', () => {
  const pins = ref<Pin[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const creating = ref(false)
  const updating = ref(false)
  const deleting = ref(false)

  let abortCtrl: AbortController | null = null
  async function fetchNearby(lat: number, lng: number, radius?: number, userPos?: { lat: number; lng: number } | null): Promise<Pin[]> {
    if (abortCtrl) abortCtrl.abort()
    abortCtrl = new AbortController()
    loading.value = true
    error.value = null
    try {
      const data = await pinsApi.list(lat, lng, radius as any, abortCtrl.signal, userPos ?? null)
      const alive = (p: any) => isPinAlive(p)
      const fresh = (data || []).filter(alive)
      if (!fresh.length) {
        pins.value = pins.value.filter(alive)
        return pins.value
      }
      const seen = new Map<number, Pin>()
      ;[...pins.value, ...fresh].forEach((p: any) => seen.set(p.id, p))
      const merged = Array.from(seen.values()).filter(alive)
      merged.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      pins.value = merged.slice(0, 150)
      return pins.value
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') return pins.value
      error.value = e?.response?.data?.message ?? 'Не удалось загрузить пины'
      return pins.value
    } finally {
      loading.value = false
    }
  }

  async function fetchMine(): Promise<Pin[]> {
    const data = await pinsApi.mine()
    return (data || []).filter((p: any) => isPinAlive(p) || (p as any).status === 'scheduled')
  }

  async function fetchScheduled(): Promise<Pin[]> {
    return pinsApi.scheduled()
  }

  function pruneExpired(): void {
    pins.value = pins.value.filter((p: any) => isPinAlive(p) || (p as any).status === 'scheduled')
  }

  async function createPin(payload: CreatePinPayload): Promise<Pin> {
    creating.value = true
    error.value = null
    try {
      const pin = await pinsApi.create(payload)
      if (!pins.value.some((p) => p.id === pin.id)) pins.value.unshift(pin)
      return pin
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Ошибка создания'
      throw e
    } finally {
      creating.value = false
    }
  }

  async function updatePin(id: number, payload: UpdatePinPayload): Promise<Pin> {
    updating.value = true
    try {
      const updated = await pinsApi.update(id, payload)
      const idx = pins.value.findIndex((p) => p.id === id)
      if (idx !== -1) pins.value[idx] = { ...pins.value[idx], ...updated }
      return updated
    } finally {
      updating.value = false
    }
  }

  async function deletePin(id: number): Promise<void> {
    deleting.value = true
    try {
      await pinsApi.remove(id)
      pins.value = pins.value.filter((p) => p.id !== id)
    } finally {
      deleting.value = false
    }
  }

  async function boostPin(id: number, type: BoostType): Promise<void> {
    await pinsApi.boost(id, type)
  }

  function addRealtime(pin: Pin): void {
    if (!isPinAlive(pin as any)) {
      pins.value = pins.value.filter((p) => p.id !== pin.id)
      return
    }
    const idx = pins.value.findIndex((p) => p.id === pin.id)
    if (idx !== -1) pins.value[idx] = { ...pins.value[idx], ...pin } as Pin
    else pins.value.unshift(pin)
  }

  function removeRealtime(id: number): void {
    pins.value = pins.value.filter((p) => p.id !== id)
  }

  function patchCounts(id: number, reactions_count?: number, comments_count?: number): void {
    const idx = pins.value.findIndex((p) => p.id === id)
    if (idx === -1) return
    const p: any = pins.value[idx]
    pins.value[idx] = {
      ...p,
      ...(reactions_count !== undefined ? { reactions_count } : {}),
      ...(comments_count !== undefined ? { comments_count } : {}),
    } as Pin
  }

  return {
    pins,
    loading,
    error,
    creating,
    updating,
    deleting,
    fetchNearby,
    fetchMine,
    fetchScheduled,
    pruneExpired,
    createPin,
    updatePin: (vars: { id: number; payload: UpdatePinPayload }) => updatePin(vars.id, vars.payload),
    deletePin,
    boostPin: (vars: { id: number; type: BoostType }) => boostPin(vars.id, vars.type),
    addRealtime,
    removeRealtime,
    patchCounts,
  }
})
