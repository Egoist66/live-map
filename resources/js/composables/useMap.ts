import { ref, watch, nextTick } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { usePins } from './usePins'
import axios from 'axios'
import { usePage as useInertiaPage } from '@inertiajs/vue3'

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

export function useMap(onPinClick: (pin: any) => void, onPinEdit?: (pin: any) => void) {
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
      map.on('click', hideCtxMenu)
      map.on('dragstart', hideCtxMenu)
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

  function getCurrentUserId(): number | null {
    try { const pg: any = (useInertiaPage as any)(); if (pg?.props?.auth?.user?.id) return pg.props.auth.user.id } catch {}
    try { const p: any = (window as any).__inertia?.page?.props || (document as any).__inertiaPage || null; if (p?.auth?.user?.id) return p.auth.user.id } catch {}
    try { const el: any = document.getElementById('app') as any; if (el?.dataset?.page) { const d = JSON.parse(el.dataset.page); return d.props?.auth?.user?.id || null } } catch {}
    return null
  }
  let pinTooltip: HTMLElement | null = null
  function ensureTooltip() {
    if (pinTooltip) return pinTooltip
    pinTooltip = document.createElement('div')
    pinTooltip.className = 'hidden fixed z-[40] pointer-events-none max-w-[300px] bg-white border border-stone-200 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.18)] overflow-hidden'
    pinTooltip.style.transform = 'translate(-50%, calc(-100% - 14px))'
    document.body.appendChild(pinTooltip)
    return pinTooltip
  }
  function showPinTip(p: any, x: number, y: number) {
    const tip = ensureTooltip()
    const catIcon: any = { question: '💬', announcement: '📍', warning: '⚠️', event: '🎉', offer: '📦', help: '🤝' }
    const catLabel: any = { question: 'Вопрос', announcement: 'Объявление', warning: 'Предупреждение', event: 'Событие', offer: 'Отдам', help: 'Помощь' }
    const body = p.body ? (p.body.length > 110 ? p.body.slice(0, 110) + '…' : p.body) : ''
    const author = p.is_anonymous ? 'аноним' : (p.user?.name || 'пользователь')
    const level = p.user?.level ? ` · ${p.user.level}` : ''
    const exp = p.expires_at ? new Date(p.expires_at).toLocaleTimeString().slice(0,5) : ''
    tip.innerHTML = `<div class="p-3.5"><div class="flex items-center gap-1.5 flex-wrap"><span class="text-xs bg-stone-900 text-white rounded-full px-2 py-0.5 font-semibold">${catIcon[p.category]||'📍'} ${catLabel[p.category]||p.category}</span>${p.is_boosted?'<span class="text-[11px] bg-amber-400 text-stone-900 rounded-full px-2 py-0.5 font-bold">★ ТОП</span>':''}${p.priority==='sponsored'?'<span class="text-[11px] bg-violet-600 text-white rounded-full px-2 py-0.5 font-bold">AD</span>':''}</div><div class="font-bold text-[13px] leading-tight mt-2 text-stone-900">${p.title}</div>${body?`<div class="text-xs text-stone-600 mt-1.5 leading-relaxed">${body}</div>`:''}<div class="flex items-center gap-2 mt-2.5 text-[11px] text-stone-500 flex-wrap"><span class="bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">${author}${level}</span>${exp?`<span class="bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">до ${exp}</span>`:''}<span class="bg-white border border-stone-200 rounded-full px-2 py-0.5">❤️ ${p.reactions_count||0} · 💬 ${p.comments_count||0}</span></div></div><div class="h-1 w-full ${p.is_boosted?'bg-amber-400':p.category==='warning'?'bg-[#EA580C]':p.category==='event'?'bg-[#7C3AED]':p.category==='help'?'bg-[#DB2777]':p.category==='question'?'bg-[#2563EB]':p.category==='offer'?'bg-[#0891B2]':'bg-[#DC2626]'}"></div>`
    tip.style.left = x + 'px'
    tip.style.top = y + 'px'
    tip.classList.remove('hidden')
  }
  function hidePinTip() { if (pinTooltip) pinTooltip.classList.add('hidden') }
  let ctxMenu: HTMLElement | null = null
  let ctxPin: any = null
  function ensureCtxMenu() {
    if (ctxMenu) return ctxMenu
    ctxMenu = document.createElement('div')
    ctxMenu.className = 'hidden fixed z-[50] bg-white border border-stone-200 rounded-xl shadow-[0_10px_28px_rgba(15,23,42,0.18)] p-1.5 min-w-[160px]'
    ctxMenu.innerHTML = `<button data-act="edit" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-stone-50 flex items-center gap-2">✎ Редактировать</button><button data-act="del" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 hover:text-red-600 flex items-center gap-2">🗑 Удалить пин</button><button data-act="cancel" class="w-full text-left px-3 py-2 rounded-lg text-xs text-stone-500 hover:bg-stone-50">Отмена</button>`
    ctxMenu.addEventListener('click', async (e: any) => {
      const act = e.target.closest('[data-act]')?.dataset.act
      if (act === 'cancel') { hideCtxMenu(); return }
      if (act === 'edit' && ctxPin) {
        const pin = ctxPin
        hideCtxMenu(); hidePinTip()
        if (onPinEdit) onPinEdit(pin); else onPinClick(pin)
        return
      }
      if (act === 'del' && ctxPin) {
        const pin = ctxPin
        hideCtxMenu()
        if (!confirm(`Удалить пин "${pin.title}"?`)) return
        try { await (store as any).deletePin(pin.id); hidePinTip(); renderPins() } catch (err: any) { alert(err?.response?.data?.message || 'Не удалось удалить') }
      }
    })
    document.body.appendChild(ctxMenu)
    document.addEventListener('click', (e: any) => { if (ctxMenu && !ctxMenu.contains(e.target) && !e.target.closest('.maplibregl-marker')) hideCtxMenu() })
    document.addEventListener('keydown', (e: any) => { if (e.key==='Escape') hideCtxMenu() })
    return ctxMenu
  }
  function showCtxMenu(p: any, x: number, y: number) {
    const m = ensureCtxMenu()
    ctxPin = p
    m.style.left = x + 'px'
    m.style.top = y + 'px'
    m.classList.remove('hidden')
    const r = m.getBoundingClientRect()
    if (r.right > window.innerWidth) m.style.left = (window.innerWidth - r.width - 8) + 'px'
    if (r.bottom > window.innerHeight) m.style.top = (y - r.height - 8) + 'px'
  }
  function hideCtxMenu() { if (ctxMenu) { ctxMenu.classList.add('hidden'); ctxPin=null } }

  function renderPins() {
    if (!map || !(map as any).loaded?.() && !loaded.value) return
    markers.forEach((m) => m.remove())
    markers = []
    let pins = store.pins as any[]
    if (selectedCategory.value === 'mine') pins = pins.filter((p: any) => p.is_owner)
    else if (selectedCategory.value !== 'all') pins = pins.filter((p: any) => p.category === selectedCategory.value)
    const colorMap: any = {
      question: '#2563EB',
      announcement: '#DC2626',
      warning: '#EA580C',
      event: '#7C3AED',
      offer: '#0891B2',
      help: '#DB2777',
    }
    if (!document.getElementById('pin-soft-pulse-style')) {
      const s = document.createElement('style')
      s.id = 'pin-soft-pulse-style'
      s.textContent = `@keyframes softPulse{0%,100%{transform:scale(1);opacity:0.55}50%{transform:scale(1.75);opacity:0}} @keyframes gentleBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}`
      document.head.appendChild(s)
    }
    pins.forEach((p: any, idx: number) => {
      const wrap = document.createElement('div')
      wrap.className = 'relative grid place-items-center cursor-pointer'
      wrap.style.width = '26px'
      wrap.style.height = '26px'
      const baseColor = p.is_boosted ? '#F59E0B' : p.is_sponsored || p.priority==='sponsored' ? '#7C3AED' : (colorMap[p.category] || '#DC2626')
      const halo = document.createElement('div')
      halo.className = 'absolute rounded-full'
      halo.style.width = '22px'
      halo.style.height = '22px'
      halo.style.background = baseColor
      halo.style.opacity = '0.28'
      halo.style.animation = `softPulse 2.4s ease-in-out infinite`
      halo.style.animationDelay = `${(idx % 5) * 0.35}s`
      const core = document.createElement('div')
      core.className = 'relative rounded-full border-2 border-white shadow-[0_2px_10px_rgba(15,23,42,0.32),0_0_0_1px_rgba(15,23,42,0.08)] grid place-items-center'
      core.style.width = '18px'
      core.style.height = '18px'
      core.style.background = baseColor
      core.style.animation = `gentleBreath 2.8s ease-in-out infinite`
      core.style.animationDelay = `${(idx % 7) * 0.2}s`
      if (p.is_boosted) { core.style.boxShadow = '0 0 0 3px rgba(251,191,36,0.45), 0 2px 10px rgba(15,23,42,0.32)'; core.style.borderColor = 'white' }
      const inner = document.createElement('div')
      inner.className = 'w-1.5 h-1.5 rounded-full bg-white/95 shadow-sm'
      core.appendChild(inner)
      wrap.appendChild(halo)
      wrap.appendChild(core)
      wrap.addEventListener('mouseenter', (e: any) => showPinTip(p, e.clientX, e.clientY))
      wrap.addEventListener('mousemove', (e: any) => { if (pinTooltip && !pinTooltip.classList.contains('hidden')) { pinTooltip.style.left = e.clientX + 'px'; pinTooltip.style.top = e.clientY + 'px' } })
      wrap.addEventListener('mouseleave', hidePinTip)
      wrap.addEventListener('click', (ev: any) => { hidePinTip(); hideCtxMenu(); ev.stopPropagation(); onPinClick(p) })
      wrap.addEventListener('contextmenu', (e: any) => {
        e.preventDefault(); e.stopPropagation(); hidePinTip()
        const uid = getCurrentUserId()
        const isOwner = p.is_owner || (!!p.user?.id && p.user.id === uid)
        if (!isOwner) return
        showCtxMenu(p, e.clientX, e.clientY)
      })
      const m = new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat([p.longitude, p.latitude]).addTo(map)
      markers.push(m)
    })
  }

  let tempMarker: maplibregl.Marker | null = null
  function addTempMarker(lngLat: any) {
    if (!map) return
    if (tempMarker) tempMarker.remove()
    const el = document.createElement('div')
    el.className = 'w-7 h-7 rounded-full bg-ink-900 border-[3px] border-white shadow-xl grid place-items-center animate-[ping_2s_ease_out_infinite]'
    el.innerHTML = '<span class="w-2.5 h-2.5 bg-white rounded-full block"></span>'
    tempMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map)
  }
  function removeTempMarker() { if (tempMarker) { tempMarker.remove(); tempMarker = null } }
  let userDot: maplibregl.Marker | null = null
  function showUserLocation(lat: number, lng: number) {
    if (!map) return
    if (userDot) userDot.remove()
    const wrap = document.createElement('div')
    wrap.className = 'relative grid place-items-center'
    wrap.style.width = '20px'
    wrap.style.height = '20px'
    const pulse = document.createElement('div')
    pulse.className = 'absolute w-10 h-10 rounded-full bg-blue-500/20 animate-ping'
    const dot = document.createElement('div')
    dot.className = 'relative w-4 h-4 rounded-full bg-[#3b82f6] border-2 border-white shadow-[0_0_0_6px_rgba(59,130,246,0.25)]'
    wrap.appendChild(pulse)
    wrap.appendChild(dot)
    userDot = new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
  }
  function triggerGeolocate() {
    try {
      const ctrl: any = map?._controls?.find((c: any) => c.trigger && c._geolocateButton) || null
      if (ctrl?.trigger) ctrl.trigger()
    } catch {}
  }

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
  return { mapContainer, initMap, renderPins, addTempMarker, removeTempMarker, showUserLocation, triggerGeolocate, startPolling, stopPolling, getCenter, flyToMyLocation, bindRealtime, setThemeStyle, loaded, errorMsg, get map() { return map } }
}
