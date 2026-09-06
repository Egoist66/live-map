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
import { useToast } from 'primevue/usetoast'
import { useMapOverlays } from '@/composables/useMapOverlays'
import { useAppConfirm } from '@/composables/useAppConfirm'
import { useCustomCategories } from '@/composables/useCustomCategories'
import { useHomeZoneVisibility } from '@/composables/useHomeZoneVisibility'
import { planOf } from '@/composables/usePlanLimits'

export function useMapPage() {
  const { store, selectedCategory, filteredPins, fetchNearby } = usePins()
  const customCats = useCustomCategories()
  const categories = customCats.allCategories
  const pinDetails = usePinDetails()
  const { confirmDelete } = useAppConfirm()
  const { requestGeolocation } = useGeolocation()
  const { isDark } = useTheme()

  const showCreate = ref(false)
  const pinAddress = ref('')
  const loadingPinAddress = ref(false)
  const { address: myStreet, loading: loadingStreet, fetch: fetchStreet } = useReverseGeocode() as any

  const pinEdit = usePinEdit()
  const toast = (() => { try { return useToast() } catch { return null as any } })()

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
  const userPlan = computed(() => planOf(page.props.auth?.user))
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
    const v = Number((pinCreate.values as any)?.value?.radius_meters ?? 1000)
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
    try { void pinCreate.refreshLimit() } catch {}
    showCreate.value = true
  }

  function closeCreate() {
    showCreate.value = false
    mapApi.removeTempMarker()
  }

  watch(showCreate, (v) => {
    if (!v || pinAddress.value) return
    const lat = (pinCreate.values as any)?.value?.latitude
    const lng = (pinCreate.values as any)?.value?.longitude
    if (Number.isFinite(lat) && Number.isFinite(lng)) fetchPinAddress(lat, lng)
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
      try { await pinCreate.refreshLimit() } catch {}
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Ошибка удаления', detail: e?.response?.data?.message, life: 3000 })
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

  async function deleteCustomCategory(slug: string) {
    const ok = await confirmDelete(`Своя категория будет удалена. Пины с ней останутся, но без оформления.`, 'Удалить категорию?')
    if (!ok) return
    try {
      await customCats.remove(slug)
      if ((pinCreate.values.value as any)?.category === slug) pinCreate.setValues({ category: 'announcement' } as any)
      mapApi.renderPins()
      toast?.add({ severity: 'success', summary: 'Категория удалена', life: 2000 })
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Не удалось удалить категорию', detail: e?.response?.data?.message, life: 3000 })
    }
  }

  function openCreateFromUI() {
    if (myPos.value) pinCreate.setCoords(myPos.value.lat, myPos.value.lng)
    else {
      const c: any = mapApi.getCenter?.()
      if (c) pinCreate.setCoords(c.lat, c.lng)
    }
    try { void pinCreate.refreshLimit() } catch {}
    showCreate.value = true
  }

  function onEsc(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (showCreate.value) { closeCreate(); return }
    if (pinEdit.editing.value) { pinEdit.cancel(); return }
    if (pinDetails.editingCommentId.value) { pinDetails.cancelEditComment(); return }
    if (pinDetails.selectedPin.value) { pinDetails.closePin(); return }
  }

  async function init() {
    window.addEventListener('keydown', onEsc)
    try { void customCats.fetchAll() } catch {}
    const cached = (() => {
      try {
        const raw = localStorage.getItem('live-map:last-pos')
        if (!raw) return null
        const p = JSON.parse(raw)
        if (Number.isFinite(p?.lat) && Number.isFinite(p?.lng)) return p as { lat: number; lng: number }
      } catch {}
      return null
    })()
    const onMapClick = (e: any) => {
      const target = e.originalEvent?.target as HTMLElement
      if (target?.closest?.('.maplibregl-marker')) return
      openCreate(e.lngLat)
    }
    if (cached) {
      myPos.value = { ...cached }
      try { await fetchNearby(cached.lat, cached.lng) } catch {}
      try {
        const mine = await store.fetchMine()
        mine.forEach((p: any) => { if (!store.pins.find((x: any) => x.id === p.id)) store.pins.unshift(p) })
        store.pruneExpired()
      } catch {}
      await nextTick()
      await mapApi.initMap([cached.lng, cached.lat] as any, onMapClick)
      mapApi.renderPins()
      applyHomeZone()
      mapApi.bindRealtime()
    } else {
      await nextTick()
      await mapApi.initMap(null, onMapClick)
      mapApi.bindRealtime()
    }
    let geo: { lat: number; lng: number } | null = null
    try { geo = await requestGeolocation() } catch { geo = null }
    if (geo) {
      myPos.value = { ...geo }
      try { localStorage.setItem('live-map:last-pos', JSON.stringify(geo)) } catch {}
      fetchStreet(geo.lat, geo.lng)
      try { await fetchNearby(geo.lat, geo.lng) } catch {}
      if (cached) {
        mapApi.showUserLocation(geo.lat, geo.lng)
        applyHomeZone()
        try { mapApi.flyToMyLocation?.(geo.lat, geo.lng) } catch {}
      } else {
        await mapApi.initMap([geo.lng, geo.lat] as any, onMapClick)
        mapApi.showUserLocation(geo.lat, geo.lng)
        applyHomeZone()
        try { mapApi.flyToMyLocation?.(geo.lat, geo.lng) } catch {}
      }
      mapApi.renderPins()
      setTimeout(() => applyHomeZone(), 1200)
    } else if (!cached) {
      try { await fetchNearby(0, 20) } catch {}
    }
    try {
      ;(mapApi.map as any)?.on('geolocate', (e: any) => {
        const c = e.coords
        if (!c) return
        const next = { lat: c.latitude, lng: c.longitude }
        myPos.value = next
        try { localStorage.setItem('live-map:last-pos', JSON.stringify(next)) } catch {}
        fetchStreet(next.lat, next.lng)
        mapApi.showUserLocation(next.lat, next.lng)
        applyHomeZone()
      })
    } catch {}
  }

  function destroy() { window.removeEventListener('keydown', onEsc); try { (mapApi as any).unbindRealtime?.() } catch {} }

  return {
    store, categories, customCats, selectedCategory, filteredPins, pinDetails, pinCreate, pinEdit, mapApi,
    showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet,
    radiusOptions, radiusLabel, homeZone, homeZoneVisible, toggleHomeZone, setHomeZoneVisible, openCreate, openCreateFromUI, closeCreate, deleteSelectedPin, saveEdit, deleteCustomCategory, init, destroy,
    deleteMutation,
    ...overlays,
  }
}
