<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { strokeToRing, type BrushPoint } from '@/utils/districtGeo'

const props = defineProps<{ armed: boolean; brushPx: number; brushRadiusM?: number; draftStrokes: BrushPoint[][]; map: any }>()
const emit = defineEmits<{ (e: 'stroke-end', points: Array<{ x: number; y: number }>): void }>()

/** Живой мазок в пикселях экрана. */
const livePoints = ref<Array<{ x: number; y: number }>>([])
/** Счётчик для перепроецирования при движении карты. */
const frame = ref(0)

let drawing = false
let lastX = 0
let lastY = 0

/**
 * Спроецировать черновик в экран (пересчёт при каждом движении карты).
 *
 * Замкнутые контуры рисуем залитым островком (как сохранится),
 * обычные мазки — лентой по центру.
 */
const draftPolygons = computed(() => {
  void frame.value
  const map = props.map
  if (!map?.project) {
    return [] as Array<Array<{ x: number; y: number }>>
  }
  const out: Array<Array<{ x: number; y: number }>> = []
  const brushM = Number(props.brushRadiusM ?? 220) || 220
  for (const stroke of props.draftStrokes ?? []) {
    const ring = strokeToRing(stroke ?? [], brushM)
    const source: Array<{ lng: number; lat: number }> = ring?.length
      ? ring.map(([lng, lat]) => ({ lng, lat }))
      : (stroke ?? [])
    const pts: Array<{ x: number; y: number }> = []
    for (const p of source) {
      try {
        const s = map.project([Number((p as any).lng), Number((p as any).lat)])
        if (Number.isFinite(s?.x) && Number.isFinite(s?.y)) {
          pts.push({ x: s.x, y: s.y })
        }
      } catch {}
    }
    if (pts.length) {
      out.push(pts)
    }
  }
  return out
})

const livePath = computed(() => livePoints.value.map((p) => `${p.x},${p.y}`).join(' '))

function bump(): void {
  frame.value++
}

function bindMap(map: any): () => void {
  if (!map?.on) {
    return () => {}
  }
  const handler = () => bump()
  try {
    map.on('move', handler)
    map.on('zoom', handler)
    map.on('resize', handler)
  } catch {}
  return () => {
    try {
      map.off?.('move', handler)
      map.off?.('zoom', handler)
      map.off?.('resize', handler)
    } catch {}
  }
}

let unbind: (() => void) | null = null
watch(
  () => props.map,
  (map) => {
    try {
      unbind?.()
    } catch {}
    unbind = bindMap(map)
    bump()
  },
  { immediate: true },
)

watch(
  () => props.armed,
  (armed) => {
    if (!armed) {
      drawing = false
      livePoints.value = []
    }
  },
)

onBeforeUnmount(() => {
  try {
    unbind?.()
  } catch {}
})

function localPoint(e: PointerEvent, el: SVGSVGElement): { x: number; y: number } | null {
  try {
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  } catch {
    return null
  }
}

function onPointerDown(e: PointerEvent): void {
  if (!props.armed) {
    return
  }
  const isMouse = e.pointerType === 'mouse'
  if (isMouse && e.button !== 0) {
    return
  }
  const el = e.currentTarget as SVGSVGElement
  const start = localPoint(e, el)
  if (!start) {
    return
  }
  drawing = true
  lastX = start.x
  lastY = start.y
  livePoints.value = [start]
  try {
    el.setPointerCapture(e.pointerId)
  } catch {}
  e.preventDefault()
  e.stopPropagation()
}

function onPointerMove(e: PointerEvent): void {
  if (!drawing || !props.armed) {
    return
  }
  const el = e.currentTarget as SVGSVGElement
  const next = localPoint(e, el)
  if (!next) {
    return
  }
  const prev = livePoints.value[livePoints.value.length - 1]
  if (prev && Math.hypot(next.x - prev.x, next.y - prev.y) < 3) {
    return
  }
  lastX = e.clientX
  lastY = e.clientY
  livePoints.value = [...livePoints.value, next]
  e.preventDefault()
}

function endStroke(e: PointerEvent): void {
  if (!drawing) {
    return
  }
  drawing = false
  const finished = livePoints.value
  livePoints.value = []
  if (finished.length) {
    emit('stroke-end', finished)
  }
  try {
    e.preventDefault()
  } catch {}
}
</script>
<template>
  <svg
    class="absolute inset-0 w-full h-full z-[6]"
    :style="{ pointerEvents: armed ? 'auto' : 'none', touchAction: armed ? 'none' : 'auto', cursor: armed ? 'crosshair' : 'default' }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endStroke"
    @pointercancel="endStroke"
  >
    <g v-for="(poly, i) in draftPolygons" :key="`draft-${i}-${poly.length}`">
      <polygon :points="poly.map((p) => `${p.x},${p.y}`).join(' ')" fill="rgba(76,29,149,0.35)" stroke="#4C1D95" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" />
    </g>
    <polyline
      v-if="livePoints.length"
      :points="livePath"
      fill="none"
      stroke="rgba(124,58,237,0.65)"
      :stroke-width="brushPx"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
