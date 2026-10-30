import * as maplibregl from 'maplibre-gl'
import { businessApi } from '@/services/business.api'
import { useBusinessMarkersStore } from '@/stores/businessMarkers'
import type { BusinessMapItem } from '@/types/entities/Business'
import type { Pin } from '@/types/entities/Pin'

let map: any = null
let markers: any[] = []
let openPinCb: ((pin: Pin) => void) | null = null
let lastFetch = 0
let inflight = false
let moveHandler: (() => void) | null = null

const FETCH_THROTTLE_MS = 3000

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number): number => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

function ensureStyle(): void {
  if (typeof document === 'undefined' || document.getElementById('biz-marker-style')) {
    return
  }
  const style = document.createElement('style')
  style.id = 'biz-marker-style'
  style.textContent =
    '@keyframes bizPulse{0%,100%{transform:scale(1);opacity:0.55}50%{transform:scale(1.7);opacity:0}}' +
    '@keyframes bizCore{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}'
  document.head.appendChild(style)
}

function clearMarkers(): void {
  markers.forEach((marker) => {
    try {
      marker.remove()
    } catch {}
  })
  markers = []
}

function briefcaseSvg(): string {
  return (
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="2" y="7" width="20" height="14" rx="2"/>' +
    '<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' +
    '</svg>'
  )
}

function buildMarker(company: BusinessMapItem): any {
  const wrap = document.createElement('div')
  wrap.className = 'relative grid place-items-center cursor-pointer'
  wrap.style.width = '56px'
  wrap.style.height = '56px'
  wrap.style.zIndex = '20'
  wrap.title = company.name

  const haloOuter = document.createElement('div')
  haloOuter.className = 'absolute rounded-full'
  haloOuter.style.inset = '0'
  haloOuter.style.background = '#6366F1'
  haloOuter.style.animation = 'bizPulse 1.6s ease-in-out infinite'

  const haloInner = document.createElement('div')
  haloInner.className = 'absolute rounded-full'
  haloInner.style.inset = '8px'
  haloInner.style.background = '#8B5CF6'
  haloInner.style.animation = 'bizPulse 1.6s ease-in-out infinite'
  haloInner.style.animationDelay = '0.55s'

  const core = document.createElement('div')
  core.className = 'relative rounded-full grid place-items-center'
  core.style.width = '38px'
  core.style.height = '38px'
  core.style.background = 'linear-gradient(135deg, #f43f5e, #d946ef)'
  core.style.border = '3px solid #fff'
  core.style.boxShadow = '0 0 0 2px rgba(99,102,241,0.55), 0 0 22px rgba(99,102,241,0.8), 0 4px 16px rgba(15,23,42,0.4)'
  core.style.animation = 'bizCore 2s ease-in-out infinite'
  core.innerHTML = briefcaseSvg()

  wrap.appendChild(haloOuter)
  wrap.appendChild(haloInner)
  wrap.appendChild(core)

  if (company.is_verified) {
    const check = document.createElement('div')
    check.textContent = '✓'
    check.style.position = 'absolute'
    check.style.top = '2px'
    check.style.right = '2px'
    check.style.width = '18px'
    check.style.height = '18px'
    check.style.borderRadius = '999px'
    check.style.background = '#10B981'
    check.style.color = '#fff'
    check.style.fontSize = '11px'
    check.style.fontWeight = '900'
    check.style.display = 'grid'
    check.style.placeItems = 'center'
    check.style.border = '2px solid #fff'
    check.style.zIndex = '3'
    wrap.appendChild(check)
  }

  if (company.pins_count > 0) {
    const count = document.createElement('div')
    count.textContent = company.pins_count > 99 ? '99+' : String(company.pins_count)
    count.style.position = 'absolute'
    count.style.bottom = '-4px'
    count.style.left = '50%'
    count.style.transform = 'translateX(-50%)'
    count.style.background = 'rgba(15,18,31,0.92)'
    count.style.color = '#fff'
    count.style.fontSize = '10px'
    count.style.fontWeight = '800'
    count.style.lineHeight = '1'
    count.style.padding = '4px 7px'
    count.style.borderRadius = '999px'
    count.style.whiteSpace = 'nowrap'
    count.style.pointerEvents = 'none'
    count.style.boxShadow = '0 2px 10px rgba(15,23,42,0.4), 0 0 0 1px rgba(255,255,255,0.85)'
    count.style.zIndex = '3'
    wrap.appendChild(count)
  }

  wrap.addEventListener('click', (event: Event) => {
    try {
      event.stopPropagation()
    } catch {}
    const businessMarkersStore = useBusinessMarkersStore()
    void businessMarkersStore.openCompany(company.id)
  })

  return wrap
}

function renderMarkers(): void {
  if (!map) {
    return
  }
  const businessMarkersStore = useBusinessMarkersStore()
  ensureStyle()
  clearMarkers()
  businessMarkersStore.companies.forEach((company) => {
    const lat = Number(company.lat)
    const lng = Number(company.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return
    }
    try {
      const element = buildMarker(company)
      const marker = new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
      markers.push(marker)
    } catch {}
  })
}

/**
 * Долететь к пину компании: карта взлетает к точке и карточка открывается.
 *
 * @param pin пин из списка компании
 */
function jumpToPin(pin: Pin): void {
  try {
    const lat = Number((pin as unknown as { latitude?: number }).latitude)
    const lng = Number((pin as unknown as { longitude?: number }).longitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map?.flyTo?.({ center: [lng, lat], zoom: Math.max(Number(map?.getZoom?.() ?? 13), 14), duration: 800 })
    }
  } catch {}
  try {
    openPinCb?.(pin)
  } catch {}
}

async function fetchForView(force = false): Promise<void> {
  if (!map) {
    return
  }
  const now = Date.now()
  if (!force && now - lastFetch < FETCH_THROTTLE_MS) {
    return
  }
  if (inflight) {
    return
  }
  let center: { lat: number; lng: number } | null = null
  let radiusKm = 50
  try {
    const rawCenter = map.getCenter?.()
    const bounds = map.getBounds?.()
    if (!rawCenter || !bounds) {
      return
    }
    center = { lat: Number(rawCenter.lat), lng: Number(rawCenter.lng) }
    const north = Number(bounds.getNorth?.())
    const east = Number(bounds.getEast?.())
    if (Number.isFinite(center.lat) && Number.isFinite(center.lng) && Number.isFinite(north) && Number.isFinite(east)) {
      radiusKm = Math.max(5, Math.min(500, Math.ceil(haversineKm(center.lat, center.lng, north, east))))
    }
  } catch {
    return
  }
  if (!center) {
    return
  }
  const businessMarkersStore = useBusinessMarkersStore()
  inflight = true
  try {
    businessMarkersStore.companies = await businessApi.mapBusinesses(center.lat, center.lng, radiusKm)
    lastFetch = Date.now()
    renderMarkers()
  } catch {} finally {
    inflight = false
  }
}

function scheduleFetch(): void {
  void fetchForView(false)
}

/**
 * Привязать слой компаний к карте (как UDistrict-слой).
 *
 * mod-business lazily loaded chunk: map-слой и maplibre живут тут,
 * state/action модалки (opened, companyPins, openCompanyPin) — в
 * stores/businessMarkers, чтобы модалка не импортировала этот модуль.
 *
 * @param mapApi объект карты из useMap (map/getBounds/flyTo)
 * @param callbacks открытие пина в карточке
 * @example bizMarkers.attach(mapApi, { openPin: (pin) => pinDetails.openPinById(pin.id) })
 */
export function useBusinessMarkers() {
  const businessMarkersStore = useBusinessMarkersStore()

  /**
   * Клик по пину компании на карте: флай-ту и открытие карточки.
   */
  function jumpToPinOf(pin: Pin): void {
    jumpToPin(pin)
  }

  function attach(api: { map?: unknown }, callbacks: { openPin: (pin: Pin) => void }): void {
    map = (api as { map?: unknown }).map ?? null
    openPinCb = callbacks.openPin
    if (!map) {
      return
    }
    if (!moveHandler) {
      moveHandler = () => scheduleFetch()
      try {
        map.on?.('moveend', moveHandler)
      } catch {}
      try {
        map.on?.('zoomend', moveHandler)
      } catch {}
    }
    businessMarkersStore.registerPinJumpHooks({ jumpToPin: jumpToPinOf })
    void fetchForView(true)
  }

  function detach(): void {
    try {
      if (map && moveHandler) {
        map.off?.('moveend', moveHandler)
        map.off?.('zoomend', moveHandler)
      }
    } catch {}
    moveHandler = null
    map = null
    openPinCb = null
    clearMarkers()
    businessMarkersStore.reset()
    businessMarkersStore.registerPinJumpHooks(null)
  }

  return {
    attach,
    detach,
    refresh: () => fetchForView(true),
  }
}
