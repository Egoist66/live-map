import { ref, watch, nextTick } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { usePins } from './usePins'
import { useDistrictsStore } from '@/stores/districts'
import { useCustomCategories } from './useCustomCategories'
import { isPinAlive } from './usePinExpiry'
import { useThrottledMapFetch } from './useThrottledMapFetch'
import { useAppConfirm } from './useAppConfirm'
import { usePage as useInertiaPage } from '@inertiajs/vue3'
import { GEO_BLUR_DEFAULT, formatBlurMeters, pinBlurInfo } from './useLocationBlur'
import { isPinVisibleLocally } from './usePinVisibility'
import { busEmit, busOn, registerPollContextProvider } from '@/services/realtime-bus'

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
  let geoControl: any = null
  const geoListeners = new Set<(e: any) => void>()
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
      geoControl = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true, timeout: 8000 }, trackUserLocation: false, showAccuracyCircle: false, showUserLocation: false, fitBoundsOptions: { maxZoom: 15 } } as any)
      map.addControl(geoControl, 'bottom-right')
      geoListeners.forEach((cb) => {
        try { geoControl.on('geolocate', cb) } catch {}
      })
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      const onReady = () => {
        if (loaded.value) return
        loaded.value = true
        clearTimeout(loadTimer)
        map.resize()
        if (homeZoneState) drawHomeZone(homeZoneState.lat, homeZoneState.lng, homeZoneState.radiusKm)
        renderPins()
        renderDistricts(lastDistricts)
        if (lastDraftGeoJson) previewDraft(lastDraftGeoJson)
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
      try {
        map.on('styledata', () => {
          try { renderDistricts(lastDistricts) } catch {}
          try { if (lastDraftGeoJson) previewDraft(lastDraftGeoJson) } catch {}
        })
      } catch {}
      map.on('click', hideCtxMenu)
      map.on('click', hidePinTip)
      map.on('dragstart', hideCtxMenu)
      map.on('dragstart', hidePinTip)
      try {
        ;(map as any).on?.('movestart', hidePinTip)
        ;(map as any).on?.('zoomstart', hidePinTip)
      } catch {}
      try { mapContainer.value?.addEventListener?.('mouseleave', hidePinTip) } catch {}
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
  let tipTimer: ReturnType<typeof setTimeout> | null = null
  let tipGlobalBound = false
  function ensureTooltip() {
    if (pinTooltip) return pinTooltip
    pinTooltip = document.createElement('div')
    pinTooltip.className = 'hidden fixed z-[40] pointer-events-none max-w-[300px] bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.18)] overflow-hidden'
    pinTooltip.style.transform = 'translate(-50%, calc(-100% - 14px))'
    document.body.appendChild(pinTooltip)
    if (!tipGlobalBound) {
      tipGlobalBound = true
      window.addEventListener('scroll', hidePinTip, true)
      window.addEventListener('blur', hidePinTip)
      document.addEventListener('pointerdown', hidePinTip, true)
      document.addEventListener('keydown', (e: any) => { if (e?.key === 'Escape') hidePinTip() })
      document.addEventListener('visibilitychange', () => { if (document.hidden) hidePinTip() })
    }
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
    const inviteHint = p.is_invited ? `<div class="mt-2 text-[11px] leading-snug bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl px-2.5 py-1.5">🎫 Вас пригласили — видно вне зоны и страны</div>` : ''
    tip.innerHTML = `<div class="p-3.5 bg-white dark:bg-zinc-800"><div class="flex items-center gap-1.5 flex-wrap"><span class="text-xs bg-stone-900 dark:bg-white dark:text-zinc-900 text-white rounded-full px-2 py-0.5 font-semibold">${catIcon[p.category]||'📍'} ${catLabel[p.category]||p.category}</span>${p.is_boosted?'<span class="text-[11px] bg-amber-400 text-stone-900 rounded-full px-2 py-0.5 font-bold">★ ТОП</span>':''}${p.priority==='sponsored'?'<span class="text-[11px] bg-violet-600 text-white rounded-full px-2 py-0.5 font-bold">AD</span>':''}${p.is_invited?'<span class="text-[11px] bg-emerald-500 text-white rounded-full px-2 py-0.5 font-bold">🎫 Приглашение</span>':''}</div><div class="font-bold text-[13px] leading-tight mt-2 text-stone-900 dark:text-white">${p.title}</div>${body?`<div class="text-xs text-stone-600 dark:text-zinc-300 mt-1.5 leading-relaxed">${body}</div>`:''}${inviteHint}${blurHint}<div class="flex items-center gap-2 mt-2.5 text-[11px] text-stone-500 dark:text-zinc-400 flex-wrap"><span class="bg-stone-100 dark:bg-zinc-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-600 rounded-full px-2 py-0.5">${author}${level}</span>${exp?`<span class="bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-900 rounded-full px-2 py-0.5">до ${exp}</span>`:''}<span class="bg-white dark:bg-zinc-700 dark:text-zinc-200 border border-stone-200 dark:border-zinc-600 rounded-full px-2 py-0.5">❤️ ${p.reactions_count||0} · 💬 ${p.comments_count||0}</span></div></div><div class="h-1 w-full ${p.is_boosted?'bg-amber-400':p.category==='sos'?'bg-[#B91C1C]':p.category==='warning'?'bg-[#EA580C]':p.category==='event'?'bg-[#7C3AED]':p.category==='help'?'bg-[#DB2777]':p.category==='question'?'bg-[#2563EB]':p.category==='offer'?'bg-[#0891B2]':'bg-[#DC2626]'}"></div>`
    tip.style.left = x + 'px'
    tip.style.top = y + 'px'
    tip.classList.remove('hidden')
    if (tipTimer) clearTimeout(tipTimer)
    tipTimer = setTimeout(hidePinTip, 4000)
  }
  function hidePinTip() {
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null }
    if (pinTooltip) pinTooltip.classList.add('hidden')
  }
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
    hidePinTip()
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
      s.textContent = `@keyframes softPulse{0%,100%{transform:scale(1);opacity:0.55}50%{transform:scale(1.85);opacity:0}} @keyframes gentleBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}} @keyframes pinGlow{0%,100%{box-shadow:0 0 0 0 rgba(250,204,21,0.5)}50%{box-shadow:0 0 0 10px rgba(250,204,21,0)}} @keyframes badgePop{0%{transform:translateX(-50%) scale(0.5)}60%{transform:translateX(-50%) scale(1.15)}100%{transform:translateX(-50%) scale(1)}} @keyframes sosBlink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(0.9)}} @keyframes inviteRing{0%,100%{transform:scale(1);opacity:0.7}50%{transform:scale(1.6);opacity:0}}`
      document.head.appendChild(s)
    }
    pins.forEach((p: any, idx: number) => {
      const wrap = document.createElement('div')
      wrap.className = 'relative grid place-items-center cursor-pointer will-change-transform'
      const sz = Math.round(34 * scale)
      wrap.style.width = sz+'px'
      wrap.style.height = sz+'px'
      const isInvited = !!p.is_invited
      const baseColor = isInvited ? '#10B981' : p.is_boosted ? '#F59E0B' : p.is_sponsored || p.priority==='sponsored' ? '#7C3AED' : colorFor(p.category)
      const isBoosted = !!p.is_boosted
      const isSosPin = String((p as any).category ?? '') === 'sos'
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
      if (isInvited && !isSosPin) {
        halo.style.background = '#10B981'
        halo.style.opacity = '0.5'
        halo.style.animation = 'inviteRing 1.6s ease-in-out infinite'
        core.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.45), 0 0 18px rgba(16,185,129,0.8), 0 4px 16px rgba(15,23,42,0.35)'
      }
      if (isSosPin) {
        core.style.width = (30*scale)+'px'
        core.style.height = (30*scale)+'px'
        core.style.background = '#DC2626'
        core.style.borderColor = '#7F1D1D'
        core.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.35), 0 0 26px rgba(220,38,38,0.9), 0 4px 16px rgba(15,23,42,0.35)'
        core.style.animation = 'sosBlink 1.1s ease-in-out infinite'
        halo.style.opacity = '0.45'
        halo.style.background = '#DC2626'
        halo.style.animation = 'softPulse 1.1s ease-in-out infinite'
      }
      const inner = document.createElement('div')
      inner.className = 'rounded-full bg-white shadow-sm'
      inner.style.width = (isBoosted? 9*scale: 7*scale)+'px'
      inner.style.height = (isBoosted? 9*scale: 7*scale)+'px'
      if(isBoosted) inner.textContent='★'
      if(isBoosted) { inner.className='rounded-full bg-white text-amber-600 grid place-items-center font-black'; inner.style.fontSize='9px'; inner.style.width=(12*scale)+'px'; inner.style.height=(12*scale)+'px' }
      if (isInvited && !isSosPin && !isBoosted) { inner.className='rounded-full bg-white grid place-items-center'; inner.style.fontSize='8px'; inner.style.width=(12*scale)+'px'; inner.style.height=(12*scale)+'px'; inner.textContent='✉️' }
      if (!isSosPin) core.appendChild(inner)
      wrap.appendChild(halo)
      wrap.appendChild(core)
      if (isInvited) {
        const inviteBadge = document.createElement('div')
        inviteBadge.textContent = '🎫 Приглашение'
        inviteBadge.style.position = 'absolute'
        inviteBadge.style.top = '-13px'
        inviteBadge.style.left = '50%'
        inviteBadge.style.transform = 'translateX(-50%)'
        inviteBadge.style.background = '#059669'
        inviteBadge.style.color = '#fff'
        inviteBadge.style.fontSize = '10px'
        inviteBadge.style.fontWeight = '800'
        inviteBadge.style.lineHeight = '1'
        inviteBadge.style.padding = '4px 7px'
        inviteBadge.style.borderRadius = '999px'
        inviteBadge.style.whiteSpace = 'nowrap'
        inviteBadge.style.pointerEvents = 'none'
        inviteBadge.style.boxShadow = '0 2px 10px rgba(5,150,105,0.5), 0 0 0 1px rgba(255,255,255,0.85)'
        inviteBadge.style.zIndex = '6'
        wrap.appendChild(inviteBadge)
      }
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
      wrap.addEventListener('pointerleave', hidePinTip)
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
      if (tipTimer) clearTimeout(tipTimer)
      tipTimer = setTimeout(hidePinTip, 4000)
    })
    wrap.addEventListener('mousemove', (e: any) => { if (pinTooltip && !pinTooltip.classList.contains('hidden')) { pinTooltip.style.left = e.clientX + 'px'; pinTooltip.style.top = e.clientY + 'px' } })
    wrap.addEventListener('mouseleave', hidePinTip)
    wrap.addEventListener('pointerleave', hidePinTip)
    wrap.addEventListener('click', hidePinTip)
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
      if (geoControl?.trigger) {
        geoControl.trigger()
        return
      }
      const ctrl: any = map?._controls?.find((c: any) => c.trigger && c._geolocateButton) || null
      if (ctrl?.trigger) ctrl.trigger()
    } catch {}
  }

  /**
   * Подписка на живые фиксы кнопки геолокации.
   *
   * Событие `geolocate` фаерится на самом GeolocateControl, а не на карте,
   * поэтому слушать `map.on('geolocate')` бесполезно — подписка идёт на контрол
   * и переживает пересоздание карты. Пейлоад — GeolocationPosition.
   * @param cb обработчик фикса
   * @returns функция отписки
   */
  function onGeolocate(cb: (e: any) => void): () => void {
    geoListeners.add(cb)
    try { geoControl?.on('geolocate', cb) } catch {}
    return () => {
      geoListeners.delete(cb)
      try { geoControl?.off('geolocate', cb) } catch {}
    }
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
  let homeZoneSvg: SVGSVGElement | null = null
  let homeZoneCircle: SVGCircleElement | null = null
  let homeZoneBound = false

  function ensureHomeZoneEvents() {
    if (homeZoneBound || !map) return
    homeZoneBound = true
    const update = () => updateHomeZonePixels()
    try {
      ;(map as any).on?.('zoom', update)
      ;(map as any).on?.('zoomend', update)
      ;(map as any).on?.('move', update)
      ;(map as any).on?.('rotate', update)
      ;(map as any).on?.('pitch', update)
      ;(map as any).on?.('resize', update)
      ;(map as any).on?.('idle', update)
    } catch {}
  }

  /**
   * Точка строго на восток от центра на radiusKm км (точная сферическая формула).
   */
  function eastPoint(lat: number, lng: number, radiusKm: number): [number, number] {
    const rad = Math.PI / 180
    const dist = radiusKm / 6371.0
    const lat1 = lat * rad
    const lng1 = lng * rad
    const sinLat1 = Math.sin(lat1)
    const cosLat1 = Math.cos(lat1)
    const sinDist = Math.sin(dist)
    const cosDist = Math.cos(dist)
    const lat2 = Math.asin(sinLat1 * cosDist)
    const lng2 = lng1 + Math.atan2(sinDist * cosLat1, cosDist - sinLat1 * Math.sin(lat2))
    return [lng2 / rad, lat2 / rad]
  }

  function updateHomeZonePixels() {
    if (!map || !homeZoneState || !homeZoneSvg || !homeZoneCircle) return
    try {
      const lat = homeZoneState.lat
      const lng = homeZoneState.lng
      const center = (map as any)?.project?.([lng, lat])
      const edge = (map as any)?.project?.(eastPoint(lat, lng, homeZoneState.radiusKm))
      if (!center || !edge) return
      const dx = Number(edge.x) - Number(center.x)
      const dy = Number(edge.y) - Number(center.y)
      const radiusPx = Math.sqrt(dx * dx + dy * dy)
      if (!Number.isFinite(radiusPx) || radiusPx <= 0) return
      const size = Math.min(Math.max(radiusPx * 2, 20), 6000)
      const radius = size / 2
      homeZoneSvg.setAttribute('width', String(Math.round(size)))
      homeZoneSvg.setAttribute('height', String(Math.round(size)))
      homeZoneSvg.style.width = `${Math.round(size)}px`
      homeZoneSvg.style.height = `${Math.round(size)}px`
      homeZoneCircle.setAttribute('cx', String(radius))
      homeZoneCircle.setAttribute('cy', String(radius))
      homeZoneCircle.setAttribute('r', String(Math.max(radius - 1, 1)))
    } catch {}
  }

  function drawHomeZone(lat: number, lng: number, radiusKm: number) {
    homeZoneState = { lat, lng, radiusKm }
    if (!map) return
    ensureHomeZoneEvents()
    try {
      if (!homeZoneMarker) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.style.display = 'block'
        svg.style.overflow = 'visible'
        svg.style.pointerEvents = 'none'
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('fill', 'rgba(124,58,237,0.14)')
        circle.setAttribute('stroke', 'rgba(124,58,237,0.7)')
        circle.setAttribute('stroke-width', '2')
        circle.setAttribute('stroke-dasharray', '8 6')
        circle.style.pointerEvents = 'none'
        svg.appendChild(circle)
        homeZoneSvg = svg
        homeZoneCircle = circle
        homeZoneMarker = new maplibregl.Marker({ element: svg as unknown as HTMLElement, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
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
    const r = Math.min(Math.max(Number(radiusKm) || 1, 1), 500)
    drawHomeZone(la, ln, r)
  }

  function hideHomeZone() {
    homeZoneState = null
    try {
      if (homeZoneMarker) {
        homeZoneMarker.remove()
        homeZoneMarker = null
        homeZoneSvg = null
        homeZoneCircle = null
      }
    } catch {}
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
  }

  let lastDistricts: any[] = []
  let districtsHidden = false
  let lastDraftGeoJson: any | null = null
  let districtClickCb: ((id: number) => void) | null = null
  let districtClickAt = 0

  interface DistrictMarkerEntry {
    marker: any
    svg: SVGSVGElement
    path: SVGPathElement
    district: any
  }
  let districtMarkers: DistrictMarkerEntry[] = []
  let districtEventsBound = false
  let districtTip: HTMLElement | null = null
  let districtTipTimer: ReturnType<typeof setTimeout> | null = null
  let districtMenu: HTMLElement | null = null
  let districtMenuId = 0
  let districtMenuCb: ((action: 'open' | 'delete', id: number) => void) | null = null

  /**
   * Подписаться на действия контекстного меню района.
   *
   * @param cb обработчик (open|delete, id района)
   */
  function onDistrictMenu(cb: (action: 'open' | 'delete', id: number) => void): void {
    districtMenuCb = cb
  }

  function ensureDistrictMenu(): HTMLElement {
    if (districtMenu) return districtMenu
    const menu = document.createElement('div')
    menu.className =
      'hidden fixed z-50 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-[0_10px_28px_rgba(76,29,149,0.25)] p-1.5 min-w-[180px]'
    menu.addEventListener('click', (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest?.('[data-act]') as HTMLElement | null
      const act = target?.dataset.act
      const id = districtMenuId
      hideDistrictMenu()
      if (!act || !(id > 0)) return
      if (act === 'cancel') return
      try { districtMenuCb?.(act as 'open' | 'delete', id) } catch {}
    })
    document.body.appendChild(menu)
    districtMenu = menu
    document.addEventListener('click', (e: Event) => {
      if (districtMenu && !districtMenu.contains(e.target as Node)) hideDistrictMenu()
    })
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideDistrictMenu()
    })
    return menu
  }

  /**
   * Показать меню района: открыть всем, удалить — владельцу.
   *
   * @param d карточка района
   * @param x экранная координата
   * @param y экранная координата
   */
  function showDistrictMenu(d: any, x: number, y: number): void {
    const menu = ensureDistrictMenu()
    hideDistrictTip()
    hideCtxMenu()
    districtMenuId = Number(d?.id) || 0
    if (!(districtMenuId > 0)) return
    const canDelete = d?.role === 'owner'
    menu.innerHTML =
      `<button data-act="open" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-violet-50 dark:hover:bg-violet-950/40 dark:text-white flex items-center gap-2">🏘️ Открыть район</button>` +
      (canDelete
        ? `<button data-act="del" class="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-2">🗑 Удалить район</button>`
        : ``) +
      `<button data-act="cancel" class="w-full text-left px-3 py-2 rounded-lg text-xs text-stone-500 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-700">Отмена</button>`
    // normalize dataset key: del -> delete
    menu.querySelector('[data-act="del"]')?.setAttribute('data-act', 'delete')
    menu.style.left = `${x}px`
    menu.style.top = `${y}px`
    menu.classList.remove('hidden')
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`
    if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height - 8}px`
  }

  function hideDistrictMenu(): void {
    if (districtMenu) districtMenu.classList.add('hidden')
    districtMenuId = 0
  }

  /**
   * Экранировать пользовательский текст для тултипа.
   */
  function escapeTipText(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  /**
   * Подпись интереса для тултипа района.
   */
  function districtInterestEmoji(interest: unknown): string {
    const map: Record<string, string> = {
      neighbors: '🏘️',
      sport: '⚽',
      music: '🎵',
      pets: '🐾',
      kids: '🧸',
      food: '🍲',
      study: '📚',
      games: '🎮',
      art: '🎨',
      help: '🤝',
    }
    return map[String(interest ?? '')] ?? '🏘️'
  }

  function ensureDistrictTip(): HTMLElement {
    if (districtTip) return districtTip
    const tip = document.createElement('div')
    tip.className =
      'hidden fixed z-[40] pointer-events-none max-w-[260px] bg-white dark:bg-zinc-800 border border-violet-200 dark:border-violet-900/60 rounded-2xl shadow-[0_12px_32px_rgba(76,29,149,0.25)] overflow-hidden'
    tip.style.transform = 'translate(-50%, calc(-100% - 14px))'
    document.body.appendChild(tip)
    districtTip = tip
    return tip
  }

  /**
   * Показать тултип района при наведении: кто, чей, сколько жителей.
   *
   * @param d карточка района
   * @param x экранная координата курсора
   * @param y экранная координата курсора
   */
  function showDistrictTip(d: any, x: number, y: number): void {
    const tip = ensureDistrictTip()
    const name = escapeTipText(d?.name ?? 'Район')
    const owner = escapeTipText(d?.owner?.name ?? '—')
    const members = Number(d?.members_count ?? 1)
    tip.innerHTML =
      `<div class="p-3 bg-white dark:bg-zinc-800">` +
      `<div class="flex items-center gap-1.5"><span class="text-xs bg-violet-700 text-white rounded-full px-2 py-0.5 font-semibold">${districtInterestEmoji(d?.interest)} UDistrict</span></div>` +
      `<div class="font-bold text-[13px] leading-tight mt-1.5 text-stone-900 dark:text-white">${name}</div>` +
      `<div class="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">Владелец: ${owner} · 👥 ${members}</div>` +
      `<div class="text-[11px] font-bold text-violet-700 dark:text-violet-300 mt-1">Клик — открыть район</div>` +
      `</div><div class="h-1 w-full bg-gradient-to-r from-violet-700 to-purple-900"></div>`
    tip.style.left = `${x}px`
    tip.style.top = `${y}px`
    tip.classList.remove('hidden')
    if (districtTipTimer) clearTimeout(districtTipTimer)
    districtTipTimer = setTimeout(hideDistrictTip, 3500)
  }

  function hideDistrictTip(): void {
    if (districtTipTimer) {
      clearTimeout(districtTipTimer)
      districtTipTimer = null
    }
    districtTip?.classList.add('hidden')
  }

  /**
   * Подписаться на клик по заливке района.
   * @param cb обработчик с id района
   */
  function onDistrictClick(cb: (id: number) => void): void {
    districtClickCb = cb
  }

  /**
   * Клик по чужой заливке не должен открывать создание пина.
   * @returns true если только что кликнули район
   */
  function shouldSuppressMapClick(): boolean {
    return Date.now() - districtClickAt < 500
  }

  /**
   * Все кольца заливки района плоским списком.
   *
   * @param d карточка района
   * @returns кольца [lng,lat]
   */
  function districtRings(d: any): Array<Array<[number, number]>> {
    const coords = d?.geometry?.coordinates
    if (!Array.isArray(coords)) return []
    const rings: Array<Array<[number, number]>> = []
    for (const polygon of coords) {
      if (!Array.isArray(polygon)) continue
      for (const ring of polygon) {
        if (Array.isArray(ring) && ring.length >= 4) rings.push(ring)
      }
    }
    return rings
  }

  function clearDistrictMarkers(): void {
    for (const entry of districtMarkers) {
      try { entry.marker.remove() } catch {}
    }
    districtMarkers = []
  }

  function ensureDistrictEvents(): void {
    if (!map || districtEventsBound) return
    districtEventsBound = true
    const update = () => {
      try { updateDistrictMarkers() } catch {}
    }
    try {
      map.on('move', update)
      map.on('zoom', update)
      map.on('resize', update)
    } catch {}
  }

  /**
   * Перерисовать UDistrict-заливки тёмно-фиолетовым.
   *
   * Рендер — SVG-маркерами (как круг домашней зоны): не зависит
   * от стиля карты и виден всегда. Клик по заливке открывает район.
   *
   * @param list районы из стора
   */
  function renderDistricts(list: any[]): void {
    lastDistricts = Array.isArray(list) ? [...list] : []
    clearDistrictMarkers()
    if (!map || !loaded.value) return
    ensureDistrictEvents()
    for (const d of lastDistricts) {
      try {
        const rings = districtRings(d)
        if (!rings.length) continue
        const centerLng = Number(d.center_lng)
        const centerLat = Number(d.center_lat)
        if (!Number.isFinite(centerLng) || !Number.isFinite(centerLat)) continue
        const el = document.createElement('div')
        el.style.pointerEvents = 'auto'
        el.style.cursor = 'pointer'
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.style.display = 'block'
        svg.style.overflow = 'visible'
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('fill', 'rgba(76,29,149,0.32)')
        path.setAttribute('stroke', '#6D28D9')
        path.setAttribute('stroke-width', '2')
        path.setAttribute('fill-rule', 'evenodd')
        path.style.pointerEvents = 'auto'
        svg.appendChild(path)
        el.appendChild(svg)
        const id = Number(d.id)
        el.addEventListener('click', (e: Event) => {
          try { e.stopPropagation() } catch {}
          hideDistrictTip()
          districtClickAt = Date.now()
          try { districtClickCb?.(id) } catch {}
        })
        el.addEventListener('mouseenter', (e: MouseEvent) => {
          try { showDistrictTip(d, e.clientX, e.clientY) } catch {}
        })
        el.addEventListener('mouseleave', () => {
          try { hideDistrictTip() } catch {}
        })
        el.addEventListener('contextmenu', (e: MouseEvent) => {
          try { e.preventDefault() } catch {}
          try { e.stopPropagation() } catch {}
          districtClickAt = Date.now()
          try { showDistrictMenu(d, e.clientX, e.clientY) } catch {}
        })
        const marker = new maplibregl.Marker({ element: el as unknown as HTMLElement, anchor: 'center' })
          .setLngLat([centerLng, centerLat] as any)
          .addTo(map)
        districtMarkers.push({ marker, svg, path, district: d })
      } catch (e) {
        try { console.warn('UDistrict marker failed', e) } catch {}
      }
    }
    updateDistrictMarkers()
    applyDistrictsVisibility()
  }

  /**
   * Пересчитать пиксели заливок под текущий зум/центр.
   */
  function updateDistrictMarkers(): void {
    if (!map || !districtMarkers.length) return
    for (const entry of districtMarkers) {
      try {
        const d = entry.district
        const rings = districtRings(d)
        if (!rings.length) continue
        const anchor = map.project([Number(d.center_lng), Number(d.center_lat)])
        if (!anchor) continue
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        const projected = rings.map((ring) =>
          ring.map((pt) => {
            const s = map.project([Number(pt[0]), Number(pt[1])])
            const x = Number(s?.x)
            const y = Number(s?.y)
            if (Number.isFinite(x) && Number.isFinite(y)) {
              if (x < minX) minX = x
              if (y < minY) minY = y
              if (x > maxX) maxX = x
              if (y > maxY) maxY = y
            }
            return { x, y }
          }),
        )
        if (!Number.isFinite(minX) || !Number.isFinite(maxX)) continue
        const pad = 6
        const w = Math.min(Math.max(Math.ceil(maxX - minX + pad * 2), 12), 6000)
        const h = Math.min(Math.max(Math.ceil(maxY - minY + pad * 2), 12), 6000)
        const originX = anchor.x - w / 2
        const originY = anchor.y - h / 2
        const pathData = projected
          .map((ring) => `M${ring.map((p) => `${(p.x - originX).toFixed(1)},${(p.y - originY).toFixed(1)}`).join(' L')} Z`)
          .join(' ')
        entry.svg.setAttribute('width', String(w))
        entry.svg.setAttribute('height', String(h))
        entry.svg.style.width = `${w}px`
        entry.svg.style.height = `${h}px`
        const el = entry.marker.getElement() as HTMLElement | null
        if (el) {
          el.style.width = `${w}px`
          el.style.height = `${h}px`
        }
        entry.path.setAttribute('d', pathData)
      } catch {}
    }
  }

  /**
   * Применить запомненную видимость к маркерам заливок.
   */
  function applyDistrictsVisibility(): void {
    for (const entry of districtMarkers) {
      try {
        const el = entry.marker.getElement() as HTMLElement | null
        if (el) el.style.display = districtsHidden ? 'none' : ''
      } catch {}
    }
  }

  /**
   * Показать/скрыть слой районов без потери данных.
   * @param visible виден ли слой
   */
  function setDistrictsVisible(visible: boolean): void {
    districtsHidden = !visible
    applyDistrictsVisibility()
  }

  /**
   * Превью черновика кисти поверх карты.
   * @param geojson заливка-черновик или null для очистки
   */
  function previewDraft(geojson: any | null): void {
    lastDraftGeoJson = geojson ?? null
    if (!map || !loaded.value) return
    try {
      if (!(map as any).getSource?.('udistrict-draft')) {
        ;(map as any).addSource('udistrict-draft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        ;(map as any).addLayer({ id: 'udistrict-draft-fill', type: 'fill', source: 'udistrict-draft', paint: { 'fill-color': '#4C1D95', 'fill-opacity': 0.4 } })
        ;(map as any).addLayer({ id: 'udistrict-draft-line', type: 'line', source: 'udistrict-draft', paint: { 'line-color': '#4C1D95', 'line-width': 2, 'line-dasharray': [4, 3] } })
      }
      const data = !geojson
        ? { type: 'FeatureCollection', features: [] }
        : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: geojson }] }
      ;(map as any).getSource('udistrict-draft')?.setData(data)
    } catch (e) {
      try { console.warn('UDistrict draft preview failed', e) } catch {}
    }
  }

  let homeMarker: maplibregl.Marker | null = null

  function drawHomeMarker(_lat: number, _lng: number, _radiusKm: number) {}
  function getCenter() { return map?.getCenter() }
  function flyToMyLocation(lat: number, lng: number) { if (!map) return; map.flyTo({ center: [lng, lat] as any, zoom: 14.5, essential: true, duration: 1200 }) }
  let wsConnected = ref(false)
  let reconnectTimer: any = null
  let mapChannel: any = null
  let mapBusUnsubs: Array<() => void> = []
  let connBound = false
  let renderTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Отложенная перерисовка маркеров: схлопывает пачки событий тика поллинга.
   */
  function scheduleRenderPins(): void {
    if (renderTimer) return
    renderTimer = setTimeout(() => {
      renderTimer = null
      try { renderPins() } catch {}
    }, 300)
  }

  /**
   * Применяет изменения карты из поллинга.
   * @param payload upsert/deleted/counters из /api/realtime/sync
   */
  function applyMapSync(payload: any): void {
    if (!payload) return
    let touched = false
    for (const pin of (Array.isArray(payload.upsert) ? payload.upsert : [])) {
      if (!pin?.id || !isPinVisibleLocally(pin)) continue
      try { store.addRealtime(pin) } catch {}
      touched = true
    }
    for (const id of (Array.isArray(payload.deleted) ? payload.deleted : [])) {
      if (Number(id) > 0) {
        try { store.removeRealtime(Number(id)) } catch {}
        touched = true
      }
    }
    const counters = payload.counters && typeof payload.counters === 'object' ? payload.counters : {}
    for (const [id, counts] of Object.entries(counters) as Array<[string, any]>) {
      if (Number(id) > 0 && counts) {
        try { (store as any).patchCounts?.(Number(id), counts.reactions_count, counts.comments_count) } catch {}
        touched = true
      }
    }
    if (touched) scheduleRenderPins()
  }

  /**
   * Контекст карты для поллера: bbox вьюпорта и известные id.
   */
  function mapPollContext(): { mapBbox?: any; knownPinIds?: number[] } {
    try {
      if (!map) return {}
      const bounds = (map as any).getBounds?.()
      if (!bounds) return {}
      const pins = ((store as any).pins?.value ?? (store as any).pins ?? []) as any[]
      const knownPinIds = (Array.isArray(pins) ? pins : [])
        .map((p: any) => Number(p?.id))
        .filter((id: number) => id > 0)
        .slice(0, 500)
      return {
        mapBbox: {
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
        },
        knownPinIds,
      }
    } catch { return {} }
  }

  function bindRealtime() {
    const doBind = () => {
      try { if (mapChannel) (window as any).Echo?.leave('map') } catch {}
      mapBusUnsubs.forEach((off) => { try { off() } catch {} })
      mapBusUnsubs = []
      try { registerPollContextProvider('map', () => mapPollContext()) } catch {}
      const ch = (window as any).Echo?.channel('map')
      if (!ch) {
        mapBusUnsubs.push(busOn('map:pins', (payload: any) => applyMapSync(payload)))
        return
      }
      mapChannel = ch
      const onCreated = (e: any) => {
        if (!e?.pin) return
        if (!isPinVisibleLocally(e.pin)) return
        store.addRealtime(e.pin)
        renderPins()
        try { busEmit('map:pins', { upsert: [e.pin], deleted: [], counters: {} }) } catch {}
      }
      const onDeleted = (e: any) => { if (e?.pinId) { store.removeRealtime(e.pinId); renderPins(); try { busEmit('map:pins', { upsert: [], deleted: [Number(e.pinId)], counters: {} }) } catch {} } }
      const onUpdated = (e: any) => {
        if (!e?.pin) return
        if (!isPinVisibleLocally(e.pin)) {
          store.removeRealtime(e.pin.id)
          renderPins()
          try { busEmit('map:pins', { upsert: [], deleted: [Number(e.pin.id)], counters: {} }) } catch {}
          return
        }
        store.addRealtime(e.pin)
        renderPins()
        try { busEmit('map:pins', { upsert: [e.pin], deleted: [], counters: {} }) } catch {}
      }
      const onActivity = (e: any) => {
        if (!e?.pin_id) return
        lastActivePinId = Number(e.pin_id)
        try { (store as any).patchCounts?.(Number(e.pin_id), e.reactions_count, e.comments_count) } catch {}
        renderPins()
      }
      const districtStore = useDistrictsStore()
      const onDistrictChanged = (e: any) => {
        if (!e?.district?.id) return
        try { districtStore.upsertRealtime(e.district) } catch {}
        try { renderDistricts(districtStore.districts as any) } catch {}
        try { busEmit('map:district-changed', { id: Number(e.district.id) }) } catch {}
      }
      const onDistrictDeleted = (e: any) => {
        const id = Number(e?.districtId)
        if (!(id > 0)) return
        try { districtStore.removeRealtime(id) } catch {}
        try { renderDistricts(districtStore.districts as any) } catch {}
        try { busEmit('map:district-deleted', { id }) } catch {}
      }
      ch.listen('.pin.created', onCreated)
        .listen('.pin.deleted', onDeleted)
        .listen('.pin.updated', onUpdated)
        .listen('.pin.activity', onActivity)
        .listen('.pin.counters', onActivity)
        .listen('.district.created', onDistrictChanged)
        .listen('.district.updated', onDistrictChanged)
        .listen('.district.deleted', onDistrictDeleted)
      mapBusUnsubs.push(busOn('map:pins', (payload: any) => applyMapSync(payload)))
    }
    doBind()
    try {
      const pusher = (window as any).Echo?.connector?.pusher
      if (pusher && !connBound) {
        connBound = true
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
    mapBusUnsubs.forEach((off) => { try { off() } catch {} })
    mapBusUnsubs = []
    try { registerPollContextProvider('map', null) } catch {}
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null }
  }
  /**
   * Полная очистка карты при уходе со страницы: тултип/меню не должны
   * оставаться висеть поверх чата и других экранов.
   */
  function destroyMap(): void {
    hidePinTip()
    hideCtxMenu()
    hideDistrictTip()
    hideDistrictMenu()
    try { districtMenu?.remove(); districtMenu = null } catch {}
    try { districtTip?.remove(); districtTip = null } catch {}
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null }
    try { unbindRealtime() } catch {}
    try { markers.forEach((m) => m.remove()); markers = [] } catch {}
    try { if (userDot) { userDot.remove(); userDot = null } } catch {}
    try { removeTempMarker() } catch {}
    try { if (homeZoneMarker) { homeZoneMarker.remove(); homeZoneMarker = null } } catch {}
    try { clearDistrictMarkers() } catch {}
    districtEventsBound = false
    try {
      for (const layerId of ['udistrict-draft-line', 'udistrict-draft-fill']) {
        try { (map as any)?.getLayer?.(layerId) && (map as any).removeLayer(layerId) } catch {}
      }
      try { (map as any)?.getSource?.('udistrict-draft') && (map as any).removeSource('udistrict-draft') } catch {}
    } catch {}
    lastDistricts = []
    lastDraftGeoJson = null
    districtClickCb = null
    try { if (homeMarker) { homeMarker.remove(); homeMarker = null } } catch {}
    try { (map as any)?.off?.('movestart', hidePinTip) } catch {}
    try { (map as any)?.off?.('zoomstart', hidePinTip) } catch {}
    try { (map as any)?.off?.('click', hidePinTip) } catch {}
    try { (map as any)?.off?.('dragstart', hidePinTip) } catch {}
    try { (map as any)?.remove?.() } catch {}
    try { pinTooltip?.remove?.(); pinTooltip = null } catch {}
    try { ctxMenu?.remove?.(); ctxMenu = null } catch {}
  }
  function setThemeStyle(isDark: boolean) {
    return
  }
  return { mapContainer, initMap, renderPins, addTempMarker, removeTempMarker, showUserLocation, triggerGeolocate, onGeolocate, getCenter, flyToMyLocation, flyToHomeZone, bindRealtime, unbindRealtime, destroyMap, setThemeStyle, showHomeZone, hideHomeZone, renderDistricts, setDistrictsVisible, previewDraft, onDistrictClick, onDistrictMenu, shouldSuppressMapClick, loaded, errorMsg, wsConnected, get map() { return map } }
}
