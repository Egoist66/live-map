import { ref, watch, nextTick } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { usePins } from './usePins'
import { useCustomCategories } from './useCustomCategories'
import { isPinAlive } from './usePinExpiry'
import { useThrottledMapFetch } from './useThrottledMapFetch'
import { useAppConfirm } from './useAppConfirm'
import { usePage as useInertiaPage } from '@inertiajs/vue3'
import { GEO_BLUR_DEFAULT, formatBlurMeters, pinBlurInfo } from './useLocationBlur'

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
  let lastActivePinId: number | null = null
  const { store, selectedCategory } = usePins()
  const { metaOf } = useCustomCategories()
  const { confirmDelete } = useAppConfirm()
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

  async function initMap(center: [number, number] | null = null, onMapClick?: (e: any) => void, zoom = 13) {
    await nextTick()
    if (!mapContainer.value) return
    const initialCenter: [number, number] = center ?? [0, 20]
    const initialZoom = center ? zoom : 2
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
        center: initialCenter as any,
        zoom: initialZoom,
        attributionControl: false,
      } as any)
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }), 'bottom-right')
      map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true, timeout: 8000 }, trackUserLocation: true, showAccuracyCircle: false, showUserLocation: false, fitBoundsOptions: { maxZoom: 15 } } as any), 'bottom-right')
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      const onReady = () => {
        if (loaded.value) return
        loaded.value = true
        clearTimeout(loadTimer)
        map.resize()
        if (homeZoneState) drawHomeZone(homeZoneState.lat, homeZoneState.lng, homeZoneState.radiusKm)
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
      const throttled = useThrottledMapFetch(renderPins)
      const fetchForView = () => {
        if (!map) return
        const c = map.getCenter()
        const z = map.getZoom()
        const radius = z < 8 ? 50000 : z < 10 ? 30000 : z < 12 ? 15000 : z < 14 ? 8000 : 5000
        throttled.request(c.lat, c.lng, radius)
      }
      map.on('moveend', fetchForView)
      map.on('zoomend', fetchForView)
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
    pinTooltip.className = 'hidden fixed z-[40] pointer-events-none max-w-[300px] bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.18)] overflow-hidden'
    pinTooltip.style.transform = 'translate(-50%, calc(-100% - 14px))'
    document.body.appendChild(pinTooltip)
    return pinTooltip
  }
  function showPinTip(p: any, x: number, y: number) {
    const tip = ensureTooltip()
    const meta = metaOf(p.category)
    const catIcon: any = { [p.category]: meta?.i ?? '📍' }
    const catLabel: any = { [p.category]: meta?.l ?? p.category }
    const body = p.body ? (p.body.length > 110 ? p.body.slice(0, 110) + '…' : p.body) : ''
    const author = p.is_anonymous ? 'аноним' : (p.user?.name || 'пользователь')
    const level = p.user?.level ? ` · ${p.user.level}` : ''
    const exp = p.expires_at ? new Date(p.expires_at).toLocaleTimeString().slice(0,5) : ''
    const bi = pinBlurInfo(p)
    const blurHint = bi ? `<div class="mt-2 text-[11px] leading-snug bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-200 rounded-xl px-2.5 py-1.5">📍 Виртуальная точка · сдвиг ${bi.label} — не точное местоположение</div>` : ''
    tip.innerHTML = `<div class="p-3.5 bg-white dark:bg-zinc-800"><div class="flex items-center gap-1.5 flex-wrap"><span class="text-xs bg-stone-900 dark:bg-white dark:text-zinc-900 text-white rounded-full px-2 py-0.5 font-semibold">${catIcon[p.category]||'📍'} ${catLabel[p.category]||p.category}</span>${p.is_boosted?'<span class="text-[11px] bg-amber-400 text-stone-900 rounded-full px-2 py-0.5 font-bold">★ ТОП</span>':''}${p.priority==='sponsored'?'<span class="text-[11px] bg-violet-600 text-white rounded-full px-2 py-0.5 font-bold">AD</span>':''}</div><div class="font-bold text-[13px] leading-tight mt-2 text-stone-900 dark:text-white">${p.title}</div>${body?`<div class="text-xs text-stone-600 dark:text-zinc-300 mt-1.5 leading-relaxed">${body}</div>`:''}${blurHint}<div class="flex items-center gap-2 mt-2.5 text-[11px] text-stone-500 dark:text-zinc-400 flex-wrap"><span class="bg-stone-100 dark:bg-zinc-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-600 rounded-full px-2 py-0.5">${author}${level}</span>${exp?`<span class="bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-full px-2 py-0.5">до ${exp}</span>`:''}<span class="bg-white dark:bg-zinc-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-600 rounded-full px-2 py-0.5">❤️ ${p.reactions_count||0} · 💬 ${p.comments_count||0}</span></div></div><div class="h-1 w-full ${p.is_boosted?'bg-amber-400':p.category==='warning'?'bg-[#EA580C]':p.category==='event'?'bg-[#7C3AED]':p.category==='help'?'bg-[#DB2777]':p.category==='question'?'bg-[#2563EB]':p.category==='offer'?'bg-[#0891B2]':'bg-[#DC2626]'}"></div>`
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
    ctxMenu.className = 'hidden fixed z-[50] bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-[0_10px_28px_rgba(15,23,42,0.18)] p-1.5 min-w-[160px]'
    ctxMenu.innerHTML = `<button data-act="edit" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-stone-50 dark:hover:bg-zinc-700 dark:text-white flex items-center gap-2">✎ Редактировать</button><button data-act="del" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-2">🗑 Удалить пин</button><button data-act="cancel" class="w-full text-left px-3 py-2 rounded-lg text-xs text-stone-500 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-700">Отмена</button>`
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
        const ok = await confirmDelete(`Пин «${pin.title}» будет удалён навсегда вместе с комментариями.`)
        if (!ok) return
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
    const animateId = lastActivePinId
    lastActivePinId = null
    const zoom = (map as any).getZoom?.() || 13
    const scale = zoom < 10 ? 1.35 : zoom < 12 ? 1.2 : zoom < 14 ? 1 : 0.9
    markers.forEach((m) => m.remove())
    markers = []
    try { (store as any).pruneExpired?.() } catch {}
    let pins = (store.pins as any[]).filter((p: any) => isPinAlive(p))
    if (selectedCategory.value === 'mine') pins = pins.filter((p: any) => p.is_owner)
    else if (selectedCategory.value !== 'all') pins = pins.filter((p: any) => p.category === selectedCategory.value)
    const colorFor = (cat: string): string => metaOf(cat)?.c ?? '#DC2626'
    if (!document.getElementById('pin-soft-pulse-style')) {
      const s = document.createElement('style')
      s.id = 'pin-soft-pulse-style'
      s.textContent = `@keyframes softPulse{0%,100%{transform:scale(1);opacity:0.55}50%{transform:scale(1.85);opacity:0}} @keyframes gentleBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}} @keyframes pinGlow{0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,0.5)}50%{box-shadow:0 0 0 10px rgba(250,204,21,0)}} @keyframes badgePop{0%{transform:translateX(-50%) scale(0.5)}60%{transform:translateX(-50%) scale(1.15)}100%{transform:translateX(-50%) scale(1)}}`
      document.head.appendChild(s)
    }
    pins.forEach((p: any, idx: number) => {
      const wrap = document.createElement('div')
      wrap.className = 'relative grid place-items-center cursor-pointer will-change-transform'
      const sz = Math.round(34 * scale)
      wrap.style.width = sz+'px'
      wrap.style.height = sz+'px'
      const baseColor = p.is_boosted ? '#F59E0B' : p.is_sponsored || p.priority==='sponsored' ? '#7C3AED' : colorFor(p.category)
      const isBoosted = !!p.is_boosted
      const halo = document.createElement('div')
      halo.className = 'absolute rounded-full'
      halo.style.width = (isBoosted? 38*scale : 30*scale)+'px'
      halo.style.height = (isBoosted? 38*scale : 30*scale)+'px'
      halo.style.background = baseColor
      halo.style.opacity = isBoosted ? '0.38' : '0.32'
      halo.style.animation = `softPulse 2.2s ease-in-out infinite`
      halo.style.animationDelay = `${(idx % 5) * 0.28}s`
      if(isBoosted) halo.style.animation = `pinGlow 1.8s ease-in-out infinite, softPulse 2.2s ease-in-out infinite`
      const core = document.createElement('div')
      core.className = 'relative rounded-full border-[3px] border-white shadow-[0_4px_16px_rgba(15,23,42,0.35),0_0_0_1px_rgba(15,23,42,0.1)] grid place-items-center'
      core.style.width = (isBoosted? 28*scale : 22*scale)+'px'
      core.style.height = (isBoosted? 28*scale : 22*scale)+'px'
      core.style.background = baseColor
      core.style.animation = `gentleBreath 2.6s ease-in-out infinite`
      core.style.animationDelay = `${(idx % 7) * 0.18}s`
      if (isBoosted) { core.style.boxShadow = '0 0 0 4px rgba(251,191,36,0.55), 0 0 18px rgba(251,191,36,0.9), 0 4px 16px rgba(15,23,42,0.35)'; core.style.borderColor = 'white' }
      else core.style.boxShadow = '0 2px 12px rgba(15,23,42,0.32), 0 0 0 2px rgba(255,255,255,0.9)'
      const inner = document.createElement('div')
      inner.className = 'rounded-full bg-white shadow-sm'
      inner.style.width = (isBoosted? 9*scale: 7*scale)+'px'
      inner.style.height = (isBoosted? 9*scale: 7*scale)+'px'
      if(isBoosted) inner.textContent='★'
      if(isBoosted) { inner.className='rounded-full bg-white text-amber-600 grid place-items-center font-black'; inner.style.fontSize='9px'; inner.style.width=(12*scale)+'px'; inner.style.height=(12*scale)+'px' }
      core.appendChild(inner)
      wrap.appendChild(halo)
      wrap.appendChild(core)
      const rc = Number(p.reactions_count) || 0
      const cc = Number(p.comments_count) || 0
      if (rc + cc > 0) {
        const badge = document.createElement('div')
        const parts: string[] = []
        if (rc > 0) parts.push(`❤️${rc > 99 ? '99+' : rc}`)
        if (cc > 0) parts.push(`💬${cc > 99 ? '99+' : cc}`)
        badge.textContent = parts.join(' · ')
        badge.style.position = 'absolute'
        badge.style.top = '-13px'
        badge.style.left = '50%'
        badge.style.transform = 'translateX(-50%)'
        badge.style.background = 'rgba(24,24,27,0.92)'
        badge.style.color = '#fff'
        badge.style.fontSize = '10px'
        badge.style.fontWeight = '800'
        badge.style.lineHeight = '1'
        badge.style.padding = '4px 7px'
        badge.style.borderRadius = '999px'
        badge.style.whiteSpace = 'nowrap'
        badge.style.pointerEvents = 'none'
        badge.style.boxShadow = '0 2px 10px rgba(15,23,42,0.4), 0 0 0 1px rgba(255,255,255,0.85)'
        badge.style.zIndex = '5'
        if (animateId === p.id) badge.style.animation = 'badgePop 0.35s ease-out'
        wrap.appendChild(badge)
      }
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
  let lastGeo: { lat: number; lng: number; meters: number } | null = null
  let geoOffset: { dx: number; dy: number; meters: number } | null = null
  function getMyBlurMeters(): number {
    try { const pg: any = (useInertiaPage as any)(); const m = Number(pg?.props?.auth?.user?.default_blur_meters); if (!Number.isNaN(m)) return m } catch {}
    try { const p: any = (window as any).__inertia?.page?.props || (document as any).__inertiaPage || null; const m = Number(p?.auth?.user?.default_blur_meters); if (!Number.isNaN(m)) return m } catch {}
    try { const el: any = document.getElementById('app') as any; if (el?.dataset?.page) { const m = Number(JSON.parse(el.dataset.page).props?.auth?.user?.default_blur_meters); if (!Number.isNaN(m)) return m } } catch {}
    return GEO_BLUR_DEFAULT
  }
  function blurredGeo(lat: number, lng: number, meters: number): [number, number] {
    if (!meters || meters <= 0) return [lat, lng]
    if (!geoOffset || geoOffset.meters !== meters) {
      const w = Math.sqrt(Math.random())
      const t = 2 * Math.PI * Math.random()
      geoOffset = { dx: w * Math.cos(t), dy: w * Math.sin(t), meters }
    }
    const r = meters / 111300
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1
    return [Number((lat + geoOffset.dy * r).toFixed(7)), Number((lng + (geoOffset.dx * r) / cosLat).toFixed(7))]
  }
  function drawUserDot() {
    if (!map || !lastGeo) return
    const [blat, blng] = blurredGeo(lastGeo.lat, lastGeo.lng, lastGeo.meters)
    if (userDot) userDot.remove()
    const wrap = document.createElement('div')
    wrap.className = 'relative grid place-items-center'
    wrap.style.width = '20px'
    wrap.style.height = '20px'
    const meters = lastGeo.meters
    if (meters > 0) {
      try {
        const zoom = (map as any).getZoom?.() || 13
        const mpp = (156543.03392 * Math.cos((blat * Math.PI) / 180)) / Math.pow(2, zoom)
        const radiusPx = Math.min(800, meters / mpp)
        if (radiusPx > 14) {
          const area = document.createElement('div')
          area.className = 'absolute rounded-full'
          area.style.width = radiusPx * 2 + 'px'
          area.style.height = radiusPx * 2 + 'px'
          area.style.background = 'rgba(59,130,246,0.07)'
          area.style.border = '1px dashed rgba(59,130,246,0.55)'
          wrap.appendChild(area)
        }
      } catch {}
    }
    const pulse = document.createElement('div')
    pulse.className = 'absolute w-10 h-10 rounded-full bg-blue-500/20 animate-ping'
    const dot = document.createElement('div')
    dot.className = 'relative w-4 h-4 rounded-full bg-[#3b82f6] border-2 border-white shadow-[0_0_0_6px_rgba(59,130,246,0.25)]'
    wrap.appendChild(pulse)
    wrap.appendChild(dot)
    const hint = meters > 0 ? `Ваша видимая позиция сдвинута на ~${formatBlurMeters(meters)} — это не точное местоположение` : 'Ваша точная позиция'
    wrap.addEventListener('mouseenter', (e: any) => {
      const tip = ensureTooltip()
      tip.innerHTML = `<div class="px-3.5 py-2.5 text-[11px] leading-snug bg-white dark:bg-zinc-800 text-stone-700 dark:text-zinc-200">📍 <b>Вы</b> · ${hint}</div>`
      tip.style.left = e.clientX + 'px'
      tip.style.top = e.clientY + 'px'
      tip.classList.remove('hidden')
    })
    wrap.addEventListener('mousemove', (e: any) => { if (pinTooltip && !pinTooltip.classList.contains('hidden')) { pinTooltip.style.left = e.clientX + 'px'; pinTooltip.style.top = e.clientY + 'px' } })
    wrap.addEventListener('mouseleave', hidePinTip)
    userDot = new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat([blng, blat]).addTo(map)
  }
  function showUserLocation(lat: number, lng: number) {
    if (!map) return
    lastGeo = { lat, lng, meters: Math.max(0, getMyBlurMeters()) }
    drawUserDot()
    try { (map as any).off?.('zoomend', drawUserDot); (map as any).on?.('zoomend', drawUserDot) } catch {}
  }
  function triggerGeolocate() {
    try {
      const ctrl: any = map?._controls?.find((c: any) => c.trigger && c._geolocateButton) || null
      if (ctrl?.trigger) ctrl.trigger()
    } catch {}
  }

  function homeCircleCoords(lat: number, lng: number, radiusKm: number, points = 64): number[][] {
    const coords: number[][] = []
    const latR = radiusKm / 111.32
    const lngR = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180) || 1)
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * 2 * Math.PI
      coords.push([lng + lngR * Math.cos(a), lat + latR * Math.sin(a)])
    }
    return coords
  }

  let homeZoneState: { lat: number; lng: number; radiusKm: number } | null = null
  let homeZoneMarker: maplibregl.Marker | null = null
  let homeZoneEl: HTMLElement | null = null
  let homeZoneCircle: HTMLElement | null = null
  let homeZoneBound = false

  function ensureHomeZoneEvents() {
    if (homeZoneBound || !map) return
    homeZoneBound = true
    try {
      ;(map as any).on?.('zoom', updateHomeZonePixels)
      ;(map as any).on?.('zoomend', updateHomeZonePixels)
      ;(map as any).on?.('move', updateHomeZonePixels)
    } catch {}
  }

  function metersPerPixel(lat: number): number {
    try {
      const z = (map as any)?.getZoom?.() ?? 13
      return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z)
    } catch { return 20 }
  }

  function updateHomeZonePixels() {
    if (!homeZoneState || !homeZoneEl || !homeZoneCircle) return
    try {
      const mpp = metersPerPixel(homeZoneState.lat)
      const radiusPx = (homeZoneState.radiusKm * 1000) / Math.max(mpp, 0.1)
      const d = Math.min(Math.max(radiusPx * 2, 20), 4000)
      homeZoneCircle.style.width = d + 'px'
      homeZoneCircle.style.height = d + 'px'
    } catch {}
  }

  function drawHomeZone(lat: number, lng: number, radiusKm: number) {
    if (!map) {
      homeZoneState = { lat, lng, radiusKm }
      return
    }
    homeZoneState = { lat, lng, radiusKm }
    ensureHomeZoneEvents()
    try {
      if (!homeZoneMarker) {
        homeZoneEl = document.createElement('div')
        homeZoneEl.style.position = 'relative'
        homeZoneEl.style.display = 'grid'
        homeZoneEl.style.placeItems = 'center'
        homeZoneEl.style.pointerEvents = 'none'
        homeZoneCircle = document.createElement('div')
        homeZoneCircle.style.position = 'absolute'
        homeZoneCircle.style.borderRadius = '9999px'
        homeZoneCircle.style.background = 'rgba(124,58,237,0.14)'
        homeZoneCircle.style.border = '2px dashed rgba(124,58,237,0.7)'
        homeZoneCircle.style.boxShadow = 'inset 0 0 40px rgba(124,58,237,0.12)'
        homeZoneEl.appendChild(homeZoneCircle)
        homeZoneMarker = new maplibregl.Marker({ element: homeZoneEl, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
      } else {
        homeZoneMarker.setLngLat([lng, lat] as any)
      }
      updateHomeZonePixels()
    } catch {}
  }

  function showHomeZone(lat: number | null | undefined, lng: number | null | undefined, radiusKm: number | null | undefined) {
    if (lat == null || lng == null) return
    const la = Number(lat)
    const ln = Number(lng)
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return
    if (la === 0 && ln === 0) return
    const r = Math.min(Math.max(Number(radiusKm) || 1, 1), 50)
    drawHomeZone(la, ln, r)
  }

  function hideHomeZone() {
    homeZoneState = null
    try { if (homeZoneMarker) { homeZoneMarker.remove(); homeZoneMarker = null; homeZoneEl = null; homeZoneCircle = null } } catch {}
    try {
      if ((map as any)?.getLayer?.('home-zone-fill')) (map as any).removeLayer('home-zone-fill')
      if ((map as any)?.getLayer?.('home-zone-line')) (map as any).removeLayer('home-zone-line')
      if ((map as any)?.getSource?.('home-zone-src')) (map as any).removeSource('home-zone-src')
    } catch {}
    try { if (homeMarker) { homeMarker.remove(); homeMarker = null } } catch {}
  }

  function flyToHomeZone(lat: number, lng: number, radiusKm: number) {
    if (!map) return
    const z = radiusKm >= 50 ? 9 : radiusKm >= 10 ? 10 : radiusKm >= 5 ? 11 : radiusKm >= 2 ? 12 : 13
    try { map.flyTo({ center: [lng, lat] as any, zoom: z, duration: 900 }) } catch {}
    setTimeout(() => updateHomeZonePixels(), 950)
  }

  let homeMarker: maplibregl.Marker | null = null

  function drawHomeMarker(_lat: number, _lng: number, _radiusKm: number) {}
  function getCenter() { return map?.getCenter() }
  function flyToMyLocation(lat: number, lng: number) { if (!map) return; map.flyTo({ center: [lng, lat] as any, zoom: 14.5, essential: true, duration: 1200 }) }
  let wsConnected = ref(false)
  let reconnectTimer: any = null
  let mapChannel: any = null
  function bindRealtime() {
    const doBind = () => {
      try { if (mapChannel) (window as any).Echo?.leave('map') } catch {}
      const ch = (window as any).Echo?.channel('map')
      if (!ch) return
      mapChannel = ch
      const onCreated = (e: any) => { if (e?.pin) { store.addRealtime(e.pin); renderPins() } }
      const onDeleted = (e: any) => { if (e?.pinId) { store.removeRealtime(e.pinId); renderPins() } }
      const onUpdated = (e: any) => { if (e?.pin) { store.addRealtime(e.pin); renderPins() } }
      const onActivity = (e: any) => {
        if (!e?.pin_id) return
        lastActivePinId = Number(e.pin_id)
        try { (store as any).patchCounts?.(Number(e.pin_id), e.reactions_count, e.comments_count) } catch {}
        renderPins()
      }
      ch.listen('PinCreated', onCreated).listen('.pin.created', onCreated)
        .listen('PinDeleted', onDeleted).listen('.pin.deleted', onDeleted)
        .listen('PinUpdated', onUpdated).listen('.pin.updated', onUpdated)
        .listen('PinActivityCreated', onActivity).listen('.pin.activity', onActivity)
    }
    doBind()
    try {
      const pusher = (window as any).Echo?.connector?.pusher
      if (pusher) {
        pusher.connection.bind('connected', () => { wsConnected.value = true; if (reconnectTimer) clearTimeout(reconnectTimer); doBind() })
        pusher.connection.bind('disconnected', () => wsConnected.value = false)
        pusher.connection.bind('failed', () => wsConnected.value = false)
        pusher.connection.bind('error', () => wsConnected.value = false)
        pusher.connection.bind('unavailable', () => { wsConnected.value = false; reconnectTimer = setTimeout(() => pusher.connect(), 2000) })
        if (pusher.connection.state === 'connected') wsConnected.value = true
      }
    } catch {}
  }
  function unbindRealtime() {
    try { if (mapChannel) (window as any).Echo?.leave('map'); mapChannel = null } catch {}
    if (reconnectTimer) clearTimeout(reconnectTimer)
  }
  function setThemeStyle(isDark: boolean) {
    return
  }
  return { mapContainer, initMap, renderPins, addTempMarker, removeTempMarker, showUserLocation, triggerGeolocate, getCenter, flyToMyLocation, flyToHomeZone, bindRealtime, unbindRealtime, setThemeStyle, showHomeZone, hideHomeZone, loaded, errorMsg, wsConnected, get map() { return map } }
}
