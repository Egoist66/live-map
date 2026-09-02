import { defineStore } from 'pinia'
import { ref } from 'vue'
import { pinsApi } from '@/services/pins.api'
import type { Pin, CreatePinPayload, UpdatePinPayload, BoostType } from '@/types/entities/Pin'

export const usePinsStore = defineStore('pins', () => {
  const pins = ref<Pin[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const creating = ref(false)
  const updating = ref(false)
  const deleting = ref(false)

  let abortCtrl: AbortController | null = null
  async function fetchNearby(lat: number, lng: number, radius?: number): Promise<Pin[]> {
    if (abortCtrl) abortCtrl.abort()
    abortCtrl = new AbortController()
    loading.value = true
    error.value = null
    try {
      const r = radius ?? 50000
      const data = await pinsApi.list(lat, lng, r, abortCtrl.signal)
      const seen = new Map(pins.value.map(p=>[p.id,p]))
      data.forEach(p=>seen.set(p.id,p))
      const now = Date.now()
      const merged = Array.from(seen.values()).filter(p=> new Date((p as any).expires_at).getTime() > now)
      pins.value = data.length ? merged.slice(0,150) : pins.value
      if(data.length) pins.value = data
      return data
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
    return data
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
    if (!pins.value.some((p) => p.id === pin.id)) pins.value.unshift(pin)
  }

  function removeRealtime(id: number): void {
    pins.value = pins.value.filter((p) => p.id !== id)
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
    createPin,
    updatePin: (vars: { id: number; payload: UpdatePinPayload }) => updatePin(vars.id, vars.payload),
    deletePin,
    boostPin: (vars: { id: number; type: BoostType }) => boostPin(vars.id, vars.type),
    addRealtime,
    removeRealtime,
  }
})
