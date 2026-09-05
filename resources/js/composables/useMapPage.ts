import { ref, computed, watch, nextTick } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { usePins } from '@/composables/usePins'
import { useMap } from '@/composables/useMap'
import { usePinDetails } from '@/composables/usePinDetails'
import { useGeolocation } from '@/composables/useGeolocation'
import { useTheme } from '@/composables/useTheme'
import { useReverseGeocode } from '@/composables/useReverseGeocode'
import { usePinCreate } from '@/composables/usePinCreate'
import { usePinEdit } from '@/composables/usePinEdit'
import { useMapOverlays } from '@/composables/useMapOverlays'
import { useAppConfirm } from '@/composables/useAppConfirm'

export function useMapPage() {
  const { store, categories, selectedCategory, filteredPins, fetchNearby } = usePins()
  const pinDetails = usePinDetails()
  const { confirmDelete } = useAppConfirm()
  const { requestGeolocation } = useGeolocation()
  const { isDark } = useTheme()

  const showCreate = ref(false)
  const pinAddress = ref('')
  const loadingPinAddress = ref(false)
  const { address: myStreet, loading: loadingStreet, fetch: fetchStreet } = useReverseGeocode() as any

  const pinEdit = usePinEdit()

  const pinCreate = usePinCreate(() => {
    mapApi.removeTempMarker()
    mapApi.renderPins()
    showCreate.value = false
  })

  const mapApi = useMap(pinDetails.openPin, (p: any) => {
    pinDetails.openPin(p)
    nextTick(() => pinEdit.start(p))
  })

  const overlays = useMapOverlays(
    (lat, lng) => mapApi.map?.flyTo({ center: [lng, lat] as any, zoom: 15, duration: 900 }),
    (p) => pinDetails.openPin(p),
  )

  watch(isDark, (v) => mapApi.setThemeStyle(v))

  const page: any = usePage()
  const userPlan = computed(() => page.props.auth?.user?.plan || 'free')
  const homeZone = computed(() => {
    const u = page.props.auth?.user
    if (!u?.home_lat || !u?.home_lng) return null
    return { lat: Number(u.home_lat), lng: Number(u.home_lng), radiusKm: Number(u.home_radius_km ?? 1) }
  })
  const radiusOptions = computed(() => {
    const isPro = userPlan.value === 'pro' || userPlan.value === 'business'
    return [
      { v: 500, l: '500 м' },
      { v: 1000, l: '1 км' },
      { v: 2000, l: '2 км', pro: true },
      { v: 5000, l: '5 км', pro: true },
    ].map((o) => ({ ...o, disabled: (o as any).pro && !isPro }))
  })
  const radiusLabel = computed(() => {
    const v = (pinCreate.values as any).radius_meters ?? 1000
    return v >= 1000 ? `${v / 1000} км` : `${v} м`
  })

  const deleteMutation = {
    mutateAsync: (id: number) => store.deletePin(id),
  } as any

  async function fetchPinAddress(lat: number, lng: number) {
    loadingPinAddress.value = true
    try {
      const { reverseGeocode } = await import('@/services/geo.api')
      pinAddress.value = await reverseGeocode(lat, lng)
    } catch {
      pinAddress.value = ''
    } finally {
      loadingPinAddress.value = false
    }
  }

  function openCreate(lngLat: any) {
    pinCreate.setCoords(lngLat.lat, lngLat.lng)
    fetchPinAddress(lngLat.lat, lngLat.lng)
    mapApi.addTempMarker(lngLat)
    showCreate.value = true
  }

  function closeCreate() {
    showCreate.value = false
    mapApi.removeTempMarker()
  }

  watch(showCreate, (v) => {
    if (v && !pinAddress.value) fetchPinAddress((pinCreate.values as any).latitude, (pinCreate.values as any).longitude)
  })

  watch(homeZone, (z) => {
    if (!z) return
    try { (mapApi as any).showHomeZone?.(z.lat, z.lng, z.radiusKm) } catch {}
  })

  async function deleteSelectedPin() {
    if (!pinDetails.selectedPin.value) return
    const ok = await confirmDelete(`Пин «${pinDetails.selectedPin.value.title}» будет удалён навсегда вместе с комментариями.`)
    if (!ok) return
    try {
      await (deleteMutation as any).mutateAsync(pinDetails.selectedPin.value.id)
      pinDetails.closePin()
      mapApi.renderPins()
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка удаления')
    }
  }

  watch(pinDetails.selectedPin, () => {
    pinEdit.cancel()
  })

  async function saveEdit() {
    const data: any = await pinEdit.save()
    if (data && pinDetails.selectedPin.value) Object.assign(pinDetails.selectedPin.value, data)
    mapApi.renderPins()
  }

  function openCreateFromUI() { showCreate.value = true }

  function onEsc(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (showCreate.value) { closeCreate(); return }
    if (pinEdit.editing.value) { pinEdit.cancel(); return }
    if (pinDetails.editingCommentId.value) { pinDetails.cancelEditComment(); return }
    if (pinDetails.selectedPin.value) { pinDetails.closePin(); return }
  }

  async function init() {
    window.addEventListener('keydown', onEsc)
    let geo = { lat: 53.9022, lng: 27.5615 }
    let gotGeo = false
    try { geo = await requestGeolocation(); gotGeo = true } catch {}
    if (gotGeo) fetchStreet(geo.lat, geo.lng)
    try { await fetchNearby(geo.lat, geo.lng) } catch {}
    try {
      const mine = await store.fetchMine()
      mine.forEach((p: any) => { if (!store.pins.find((x: any) => x.id === p.id)) store.pins.unshift(p) })
      store.pruneExpired()
    } catch {}
    await nextTick()
    await mapApi.initMap([geo.lng, geo.lat] as any, (e: any) => {
      const target = e.originalEvent?.target as HTMLElement
      if (target?.closest?.('.maplibregl-marker')) return
      openCreate(e.lngLat)
    })
    try {
      const hz = homeZone.value
      if (hz) (mapApi as any).showHomeZone?.(hz.lat, hz.lng, hz.radiusKm)
    } catch {}
    if (gotGeo) mapApi.showUserLocation(geo.lat, geo.lng)
    else try { mapApi.map?.setZoom(7) } catch {}
    setTimeout(() => mapApi.triggerGeolocate(), 800)
    mapApi.renderPins()
    mapApi.bindRealtime()
    try {
      ;(mapApi.map as any)?.on('geolocate', (e: any) => {
        const c = e.coords
        if (c) { fetchStreet(c.latitude, c.longitude); mapApi.showUserLocation(c.latitude, c.longitude) }
      })
    } catch {}
  }

  function destroy() { window.removeEventListener('keydown', onEsc); try { (mapApi as any).unbindRealtime?.() } catch {} }

  return {
    store, categories, selectedCategory, filteredPins, pinDetails, pinCreate, pinEdit, mapApi,
    showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet,
    radiusOptions, radiusLabel, homeZone, openCreate, openCreateFromUI, closeCreate, deleteSelectedPin, saveEdit, init, destroy,
    deleteMutation,
    ...overlays,
  }
}
