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
import { useHomeZoneVisibility } from '@/composables/useHomeZoneVisibility'

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
  const { visible: homeZoneVisible, toggle: toggleHomeZone, set: setHomeZoneVisible } = useHomeZoneVisibility()
  const myPos = ref<{ lat: number; lng: number } | null>(null)
  const homeRadiusKm = computed(() => Number(page.props.auth?.user?.home_radius_km ?? 5))
  const homeZone = computed(() => {
    if (!myPos.value) return null
    return { lat: myPos.value.lat, lng: myPos.value.lng, radiusKm: homeRadiusKm.value }
  })
  function applyHomeZone() {
    const z = homeZone.value
    if (!z || !homeZoneVisible.value) {
      try { (mapApi as any).hideHomeZone?.() } catch {}
      return
    }
    try { (mapApi as any).showHomeZone?.(z.lat, z.lng, z.radiusKm) } catch {}
  }
  const radiusOptions = computed(() => {
    const plan = userPlan.value
    const isPro = plan === 'pro' || plan === 'business'
    const isBiz = plan === 'business'
    return [
      { v: 500, l: '500 м' },
      { v: 1000, l: '1 км' },
      { v: 2000, l: '2 км' },
      { v: 5000, l: '5 км' },
      { v: 10000, l: '10 км', pro: true },
      { v: 15000, l: '15 км', pro: true },
      { v: 20000, l: '20 км', biz: true },
      { v: 50000, l: '50 км', biz: true },
    ].map((o) => ({ ...o, disabled: ((o as any).pro && !isPro) || ((o as any).biz && !isBiz) }))
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

  watch(homeZone, () => applyHomeZone())

  watch(homeZoneVisible, () => applyHomeZone())

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
    try { geo = await requestGeolocation() } catch {}
    myPos.value = { ...geo }
    fetchStreet(geo.lat, geo.lng)
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
    mapApi.showUserLocation(geo.lat, geo.lng)
    applyHomeZone()
    try { mapApi.flyToMyLocation?.(geo.lat, geo.lng) } catch {}
    mapApi.renderPins()
    setTimeout(() => applyHomeZone(), 1200)
    mapApi.bindRealtime()
    try {
      ;(mapApi.map as any)?.on('geolocate', (e: any) => {
        const c = e.coords
        if (!c) return
        myPos.value = { lat: c.latitude, lng: c.longitude }
        fetchStreet(c.latitude, c.longitude)
        mapApi.showUserLocation(c.latitude, c.longitude)
        applyHomeZone()
      })
    } catch {}
  }

  function destroy() { window.removeEventListener('keydown', onEsc); try { (mapApi as any).unbindRealtime?.() } catch {} }

  return {
    store, categories, selectedCategory, filteredPins, pinDetails, pinCreate, pinEdit, mapApi,
    showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet,
    radiusOptions, radiusLabel, homeZone, homeZoneVisible, toggleHomeZone, setHomeZoneVisible, openCreate, openCreateFromUI, closeCreate, deleteSelectedPin, saveEdit, init, destroy,
    deleteMutation,
    ...overlays,
  }
}
