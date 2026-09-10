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
import { planOf, maxHomeRadiusKm } from '@/composables/usePlanLimits'
import { resolveInitialCenter, homeAnchorOf, isSaneFix } from '@/composables/useMapInitialCenter'
import { haversineKm } from '@/utils/geo'
import { useHomeZoneGuard } from '@/composables/useHomeZoneGuard'

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
  const geoNotice = ref<{ place: string } | null>(null)
  let flewToLive = false
  let unsubGeolocate: (() => void) | null = null
  let lastStreetPos: { lat: number; lng: number; at: number } | null = null

  /**
   * Троттлинг подписи "Вы здесь": GPS на мобилке дёргается каждую секунду.
   * @param lat широта нового фикса
   * @param lng долгота нового фикса
   * @returns true если сдвиг/пауза достаточны для нового reverse-geocode
   */
  function isStreetStale(lat: number, lng: number): boolean {
    if (!lastStreetPos) {
      return true
    }
    const distKm = haversineKm(lastStreetPos.lat, lastStreetPos.lng, lat, lng)
    const elapsedMs = Date.now() - lastStreetPos.at
    const movedFar = distKm > 0.03
    const movedBitAndIdle = distKm > 0.01 && elapsedMs > 60000
    return movedFar || movedBitAndIdle
  }

  /**
   * Запрашивает улицу только при значимом сдвиге, иначе оставляет кэш.
   * @param lat широта
   * @param lng долгота
   */
  function maybeFetchStreet(lat: number, lng: number): void {
    const stale = isStreetStale(lat, lng)
    if (!stale) {
      return
    }
    lastStreetPos = { lat, lng, at: Date.now() }
    void fetchStreet(lat, lng)
  }

  /**
   * Сохраняет последнюю хорошую позицию для следующего открытия карты.
   * @param lat широта
   * @param lng долгота
   */
  function saveLastPos(lat: number, lng: number): void {
    try { localStorage.setItem('live-map:last-pos', JSON.stringify({ lat, lng })) } catch {}
  }

  /**
   * Подпись места из профиля для баннера фолбэка.
   * @param user текущий пользователь из Inertia-props
   * @returns строка вида "Минск, Беларусь" или запасной текст
   */
  function residenceLabelOf(user: any): string {
    const city = String(user?.home_city || '').trim()
    const country = String(user?.country || '').trim()
    const parts = [city, country].filter(Boolean)
    return parts.length ? parts.join(', ') : 'вашего профиля'
  }

  /**
   * Скрывает баннер фолбэка на текущую сессию.
   */
  function dismissGeoNotice(): void {
    geoNotice.value = null
  }

  /**
   * Вручную запрашивает геопозицию через кнопку контрола карты.
   */
  function locateMe(): void {
    try { mapApi.triggerGeolocate?.() } catch {}
  }
  const homeRadiusKm = computed(() => {
    const user = page.props.auth?.user as any
    const isAdmin = !!(user?.is_admin || user?.role === 'admin')
    const wanted = Number(user?.home_radius_km ?? 10) || 10
    return Math.min(Math.max(1, wanted), maxHomeRadiusKm(userPlan.value, isAdmin))
  })
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
    const isAdmin = !!(page.props.auth?.user?.is_admin || page.props.auth?.user?.role === 'admin')
    const isPro = isAdmin || plan === 'pro' || plan === 'business'
    const isBiz = isAdmin || plan === 'business'
    return [
      { v: 500, l: '500 м' },
      { v: 1000, l: '1 км' },
      { v: 2000, l: '2 км' },
      { v: 5000, l: '5 км' },
      { v: 10000, l: '10 км' },
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
    const guard = useHomeZoneGuard()
    const zone = guard.check(Number(lngLat.lat), Number(lngLat.lng), myPos.value)
    if (!zone.ok) {
      toast?.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: zone.message, life: 5000 })
      return
    }
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
    const guard = useHomeZoneGuard()
    if (myPos.value) {
      const zone = guard.check(myPos.value.lat, myPos.value.lng, myPos.value)
      if (!zone.ok) {
        toast?.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: zone.message, life: 5000 })
        return
      }
      pinCreate.setCoords(myPos.value.lat, myPos.value.lng)
    } else {
      const c: any = mapApi.getCenter?.()
      if (!c) return
      const zone = guard.check(Number(c.lat), Number(c.lng), null)
      if (!zone.ok) {
        toast?.add({ severity: 'warn', summary: 'Вне вашей зоны', detail: zone.message, life: 5000 })
        return
      }
      pinCreate.setCoords(c.lat, c.lng)
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
    const user = page.props.auth?.user as any
    const anchor = homeAnchorOf(user)
    if (anchor) myPos.value = { ...anchor }
    const start = await resolveInitialCenter(user)
    const onMapClick = (e: any) => {
      const target = e.originalEvent?.target as HTMLElement
      if (target?.closest?.('.maplibregl-marker')) return
      openCreate(e.lngLat)
    }
    await nextTick()
    const isFallback = start.source === 'residence' || start.source === 'none'
    if (isFallback && !start.hasPrecise) geoNotice.value = { place: residenceLabelOf(user) }
    if (start.center) {
      if (!myPos.value && !isFallback) myPos.value = { ...start.center }
      try { await fetchNearby(start.center.lat, start.center.lng, undefined, myPos.value) } catch {}
      try {
        const mine = await store.fetchMine()
        mine.forEach((p: any) => { if (!store.pins.find((x: any) => x.id === p.id)) store.pins.unshift(p) })
        store.pruneExpired()
      } catch {}
      const lngLat = [start.center.lng, start.center.lat] as any
      await mapApi.initMap(lngLat, onMapClick, start.zoom)
      if (start.hasPrecise) mapApi.showUserLocation(start.center.lat, start.center.lng)
      mapApi.renderPins()
      applyHomeZone()
      mapApi.bindRealtime()
    } else {
      await mapApi.initMap(null, onMapClick)
      mapApi.bindRealtime()
      try { await fetchNearby(0, 20) } catch {}
    }
    let geo: { lat: number; lng: number; accuracy: number | null } | null = null
    try { geo = await requestGeolocation() } catch { geo = null }
    if (geo) {
      const sane = isSaneFix(geo.accuracy)
      myPos.value = { lat: geo.lat, lng: geo.lng }
      if (sane) {
        saveLastPos(geo.lat, geo.lng)
        geoNotice.value = null
      }
      maybeFetchStreet(geo.lat, geo.lng)
      try { await fetchNearby(geo.lat, geo.lng, undefined, { lat: geo.lat, lng: geo.lng }) } catch {}
      mapApi.showUserLocation(geo.lat, geo.lng)
      applyHomeZone()
      if (sane && !flewToLive) {
        flewToLive = true
        try { mapApi.flyToMyLocation?.(geo.lat, geo.lng) } catch {}
      }
      mapApi.renderPins()
      setTimeout(() => applyHomeZone(), 1200)
    }
    unsubGeolocate = mapApi.onGeolocate?.((e: any) => {
      const raw = e?.coords ?? e
      const lat = Number(raw?.latitude)
      const lng = Number(raw?.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const rawAcc = Number(raw?.accuracy)
      const sane = isSaneFix(Number.isFinite(rawAcc) ? rawAcc : null)
      myPos.value = { lat, lng }
      if (sane) {
        saveLastPos(lat, lng)
        geoNotice.value = null
      }
      maybeFetchStreet(lat, lng)
      mapApi.showUserLocation(lat, lng)
      applyHomeZone()
      if (sane && !flewToLive) {
        flewToLive = true
        try { mapApi.flyToMyLocation?.(lat, lng) } catch {}
      }
    }) ?? null
    try { void consumePendingPin() } catch {}
  }

  function readPendingPin(): { pinId: number; commentId: number | null } | null {
    try {
      const q = new URLSearchParams(window.location.search)
      const qp = Number(q.get('pin') || 0)
      if (qp) return { pinId: qp, commentId: Number(q.get('comment') || 0) || null }
    } catch {}
    try {
      const raw = sessionStorage.getItem('live-map:pending-activity')
      if (!raw) return null
      const p = JSON.parse(raw)
      if (p?.type === 'pin' && Number(p.pinId)) return { pinId: Number(p.pinId), commentId: Number(p.commentId) || null }
    } catch {}
    return null
  }

  function clearPendingPin() {
    try { sessionStorage.removeItem('live-map:pending-activity') } catch {}
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.has('pin') || url.searchParams.has('comment')) {
        url.searchParams.delete('pin')
        url.searchParams.delete('comment')
        window.history.replaceState({}, '', url.toString())
      }
    } catch {}
  }

  async function consumePendingPin() {
    const target = readPendingPin()
    if (!target) return
    let pin: any = store.pins.find((x: any) => Number(x.id) === Number(target.pinId)) ?? null
    if (!pin) {
      try { pin = await pinDetails.openPinById(target.pinId, target.commentId) } catch { pin = null }
    } else {
      pinDetails.openPin(pin, target.commentId)
    }
    if (!pin && !pinDetails.selectedPin.value) return
    const opened: any = pinDetails.selectedPin.value ?? pin
    try {
      const lat = Number(opened?.latitude)
      const lng = Number(opened?.longitude)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        try { mapApi.map?.flyTo?.({ center: [lng, lat] as any, zoom: 15, duration: 900 }) } catch {}
      }
    } catch {}
    clearPendingPin()
    if (target.commentId) {
      setTimeout(() => {
        try { document.getElementById(`pin-comment-${target.commentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch {}
      }, 600)
    }
  }

  function destroy() {
    window.removeEventListener('keydown', onEsc)
    try { unsubGeolocate?.() } catch {}
    unsubGeolocate = null
    try { (mapApi as any).unbindRealtime?.() } catch {}
    try { void consumePendingPin() } catch {}
  }

  return {
    store, categories, customCats, selectedCategory, filteredPins, pinDetails, pinCreate, pinEdit, mapApi,
    showCreate, pinAddress, loadingPinAddress, myStreet, loadingStreet,
    radiusOptions, radiusLabel, homeZone, homeZoneVisible, toggleHomeZone, setHomeZoneVisible, openCreate, openCreateFromUI, closeCreate, deleteSelectedPin, saveEdit, deleteCustomCategory, init, destroy,
    deleteMutation, geoNotice, dismissGeoNotice, locateMe,
    ...overlays,
  }
}
