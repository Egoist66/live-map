import { ref, watch, nextTick } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { usePins } from './usePins'

const OSM_RASTER_STYLE: any = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 }],
}

export function useMap(onPinClick: (pin: any) => void) {
  const mapContainer = ref<HTMLElement | null>(null)
  let map: maplibregl.Map
  let markers: maplibregl.Marker[] = []
  let polling: ReturnType<typeof setInterval> | null = null
  const { store, selectedCategory } = usePins()
  const loaded = ref(false)
  const errorMsg = ref('')

  const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  const LIGHT_STYLES: any[] = [
    OSM_RASTER_STYLE,
    'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    'https://demotiles.maplibre.org/style.json',
  ]
  function getStyles() {
    return LIGHT_STYLES
  }

  async function initMap(center: [number, number] = [27.5615, 53.9022], onMapClick?: (e: any) => void) {
    await nextTick()
    if (!mapContainer.value) return
    const tryStyles: any[] = getStyles()
    let styleIndex = 0
    let loadTimer: any = null
    const create = (style: any) => {
      if (map) { try { map.remove() } catch {} }
      loaded.value = false
      errorMsg.value = ''
      clearTimeout(loadTimer)
      map = new maplibregl.Map({
        container: mapContainer.value!,
        style,
        center: center as any,
        zoom: 13,
        attributionControl: false,
      } as any)
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), 'bottom-right')
      map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true, timeout: 8000 }, trackUserLocation: true, showAccuracyCircle: true, showUserLocation: true, fitBoundsOptions: { maxZoom: 15 } } as any), 'bottom-right')
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      const onReady = () => {
        if (loaded.value) return
        loaded.value = true
        clearTimeout(loadTimer)
        map.resize()
        renderPins()
      }
      map.once('load', onReady)
      map.once('idle', onReady)
      loadTimer = setTimeout(onReady, 2500)
      map.on('styleimagemissing', () => {})
      map.on('error', (e: any) => {
        const msg = e?.error?.message || e?.error || ''
        const isStyleError = String(msg).includes('Failed to fetch') || String(msg).includes('style') || e?.status === 404 || String(msg).includes('Load failed')
        if (isStyleError && styleIndex < tryStyles.length - 1) {
          clearTimeout(loadTimer)
          styleIndex++
          errorMsg.value = 'Переключаем стиль карты…'
          setTimeout(() => create(tryStyles[styleIndex]), 300)
        } else if (isStyleError) {
          errorMsg.value = String(msg)
          onReady()
        }
        console.error('Map error', e)
      })
      if (onMapClick) map.on('click', onMapClick)
      let moveTimer: any = null
      let lastCenter = { lat: center[1], lng: center[0] }
      map.on('moveend', () => {
        if (!map) return
        const c = map.getCenter()
        const dist = Math.hypot(c.lat - lastCenter.lat, c.lng - lastCenter.lng)
        if (dist < 0.0005) return
        clearTimeout(moveTimer)
        moveTimer = setTimeout(() => {
          lastCenter = { lat: c.lat, lng: c.lng }
          store.fetchNearby(c.lat, c.lng).then(renderPins).catch(() => {})
        }, 550)
      })
    }
    create(tryStyles[0])
    watch(selectedCategory, renderPins)
  }

  function renderPins() {
    if (!map || !(map as any).loaded?.() && !loaded.value) return
    markers.forEach((m) => m.remove())
    markers = []
    const pins = selectedCategory.value === 'all' ? store.pins : store.pins.filter((p: any) => p.category === selectedCategory.value)
    pins.forEach((p: any) => {
      const el = document.createElement('div')
      const color = p.is_boosted ? 'bg-amber-400 ring-2 ring-amber-200 animate-pulse' : p.is_sponsored ? 'bg-violet-600' : p.priority === 'sponsored' ? 'bg-violet-500' : p.category === 'warning' ? 'bg-orange-500' : p.category === 'event' ? 'bg-emerald-500' : p.category === 'help' ? 'bg-sky-500' : p.category === 'question' ? 'bg-blue-500' : 'bg-rose-500'
      el.className = `w-[18px] h-[18px] sm:w-5 sm:h-5 rounded-full border-2 border-white shadow-lg cursor-pointer ${color} hover:scale-110 transition`
      el.title = p.title
      const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.longitude, p.latitude]).addTo(map)
      m.getElement().addEventListener('click', (ev: any) => { ev.stopPropagation(); onPinClick(p) })
      markers.push(m)
    })
  }

  let tempMarker: maplibregl.Marker | null = null
  function addTempMarker(lngLat: any) {
    if (!map) return
    if (tempMarker) tempMarker.remove()
    const el = document.createElement('div')
    el.className = 'w-7 h-7 rounded-full bg-ink-900 border-[3px] border-white shadow-xl grid place-items-center animate-[ping_2s_ease-out_infinite]'
    el.innerHTML = '<span class="w-2.5 h-2.5 bg-white rounded-full block"></span>'
    tempMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map)
  }
  function removeTempMarker() { if (tempMarker) { tempMarker.remove(); tempMarker = null } }

  function startPolling(intervalMs = 30000) {
    polling = setInterval(async () => {
      if (!map) return
      const c = map.getCenter()
      await store.fetchNearby(c.lat, c.lng)
      renderPins()
    }, intervalMs)
  }
  function stopPolling() { if (polling) clearInterval(polling) }
  function getCenter() { return map?.getCenter() }
  function flyToMyLocation(lat: number, lng: number) { if (!map) return; map.flyTo({ center: [lng, lat] as any, zoom: 14.5, essential: true, duration: 1200 }) }
  function bindRealtime() {
    // @ts-ignore
    window.Echo?.channel('map').listen('PinCreated', (e: any) => { store.addRealtime(e.pin); renderPins() }).listen('PinDeleted', (e: any) => { store.removeRealtime(e.pinId); renderPins() })
  }
  function setThemeStyle(isDark: boolean) {
    return
  }
  return { mapContainer, initMap, renderPins, addTempMarker, removeTempMarker, startPolling, stopPolling, getCenter, flyToMyLocation, bindRealtime, setThemeStyle, loaded, errorMsg, get map() { return map } }
}
