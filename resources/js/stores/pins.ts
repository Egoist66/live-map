import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const usePinsStore = defineStore('pins', () => {
  const pins = ref<any[]>([])
  const loading = ref(false)

  let inflight: any = null
  let lastFetch = 0
  async function fetchNearby(lat: number, lng: number) {
    const now = Date.now()
    if (inflight) return inflight
    if (now - lastFetch < 900) return Promise.resolve(pins.value)
    loading.value = true
    lastFetch = now
    inflight = axios.get('/api/pins', { params: { lat, lng } }).then(({ data }: any) => { pins.value = data; return data }).catch(() => pins.value).finally(() => { loading.value = false; inflight = null })
    return inflight
  }
  async function createPin(payload: any) {
    const { data } = await axios.post('/api/pins', payload)
    pins.value.unshift(data)
    return data
  }
  async function deletePin(id: number) {
    await axios.delete(`/api/pins/${id}`)
    pins.value = pins.value.filter(p => p.id !== id)
    return true
  }
  async function updatePin(id: number, payload: any) {
    const { data } = await axios.patch(`/api/pins/${id}`, payload)
    const idx = pins.value.findIndex(p => p.id === id)
    if (idx !== -1) pins.value[idx] = { ...pins.value[idx], ...data }
    return data
  }
  async function fetchMine() {
    const { data } = await axios.get('/api/pins/mine')
    return Array.isArray(data) ? data : data.data || []
  }
  function addRealtime(pin: any) { if (!pins.value.find(p => p.id === pin.id)) pins.value.unshift(pin) }
  function removeRealtime(id: number) { pins.value = pins.value.filter(p => p.id !== id) }

  return { pins, loading, fetchNearby, createPin, deletePin, updatePin, fetchMine, addRealtime, removeRealtime }
})
