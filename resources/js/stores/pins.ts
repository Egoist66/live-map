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
    if (now - lastFetch < 900 && !inflight) return
    if (inflight) return inflight
    loading.value = true
    lastFetch = now
    inflight = axios.get('/api/pins', { params: { lat, lng } }).then(({ data }: any) => { pins.value = data; return data }).finally(() => { loading.value = false; inflight = null })
    return inflight
  }
  async function createPin(payload: any) {
    const { data } = await axios.post('/api/pins', payload)
    pins.value.unshift(data)
    return data
  }
  function addRealtime(pin: any) { pins.value.unshift(pin) }
  function removeRealtime(id: number) { pins.value = pins.value.filter(p => p.id !== id) }

  return { pins, loading, fetchNearby, createPin, addRealtime, removeRealtime }
})
