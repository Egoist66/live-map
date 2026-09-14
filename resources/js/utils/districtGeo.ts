import type { DistrictGeometry } from '@/types/entities/District'

/**
 * Геометрия кисти UDistrict: мазки указателя в заливку MultiPolygon.
 *
 * Мазок — утолщённая ломаная: строим полосу шириной с кисть
 * (перпендикулярные отступы от каждой точки) и замыкаем в кольцо.
 * Несколько мазков дают несколько полигонов одной заливки.
 */

export interface BrushPoint {
  lat: number
  lng: number
}

/** Кисти для панели рисования: радиус в метрах. */
export const BRUSH_SIZES = [
  { v: 120, l: 'S' },
  { v: 220, l: 'M' },
  { v: 350, l: 'L' },
] as const

/** Интересы островка для формы создания. */
export const DISTRICT_INTEREST_OPTIONS = [
  { v: 'neighbors', l: 'Соседи', i: '🏘️' },
  { v: 'sport', l: 'Спорт', i: '⚽' },
  { v: 'music', l: 'Музыка', i: '🎵' },
  { v: 'pets', l: 'Питомцы', i: '🐾' },
  { v: 'kids', l: 'Дети', i: '🧸' },
  { v: 'food', l: 'Еда', i: '🍲' },
  { v: 'study', l: 'Учёба', i: '📚' },
  { v: 'games', l: 'Игры', i: '🎮' },
  { v: 'art', l: 'Творчество', i: '🎨' },
  { v: 'help', l: 'Помощь', i: '🤝' },
] as const

/**
 * Подпись интереса островка.
 *
 * @param interest ключ интереса
 * @returns эмодзи + название
 */
export function districtInterestLabel(interest: string | null | undefined): string {
  const found = DISTRICT_INTEREST_OPTIONS.find((o) => o.v === interest)
  return found ? `${found.i} ${found.l}` : '🏘️ Район'
}

const EARTH_M_PER_DEG = 111320

/**
 * Упростить мазок (Рамера-Дуглас-Пекер), чтобы не слать тысячи точек.
 *
 * @param points сырые точки мазка
 * @param tolerance допуск в градусах
 * @returns разреженный мазок
 */
export function simplifyStroke(points: BrushPoint[], tolerance = 0.0004): BrushPoint[] {
  if (points.length <= 2) {
    return [...points]
  }
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  simplifyRange(points, 0, points.length - 1, tolerance, keep)
  return points.filter((_, i) => keep[i])
}

/**
 * Превратить мазок в кольцо полигона шириной с кисть.
 *
 * @param points точки мазка (минимум 1)
 * @param brushRadiusM радиус кисти в метрах
 * @returns замкнутое кольцо [lng,lat] или null для пустого мазка
 */
export function strokeToRing(points: BrushPoint[], brushRadiusM: number): Array<[number, number]> | null {
  const line = simplifyStroke(points)
  if (!line.length) {
    return null
  }
  if (line.length === 1) {
    return circleRing(line[0], brushRadiusM)
  }
  const left: Array<[number, number]> = []
  const right: Array<[number, number]> = []
  for (let i = 0; i < line.length; i++) {
    const prev = line[Math.max(0, i - 1)]
    const next = line[Math.min(line.length - 1, i + 1)]
    const normal = strokeNormal(prev, next)
    const center = line[i]
    left.push(offsetPoint(center, normal, brushRadiusM))
    right.push(offsetPoint(center, { x: -normal.x, y: -normal.y }, brushRadiusM))
  }
  const ring = [...left, ...right.reverse()]
  ring.push(ring[0])
  return ring
}

/**
 * Собрать заливку из мазков.
 *
 * @param strokes мазки (каждый — точки указателя)
 * @param brushRadiusM радиус кисти в метрах
 * @returns MultiPolygon или null, если рисовать нечего
 */
export function strokesToGeometry(strokes: BrushPoint[][], brushRadiusM: number): DistrictGeometry | null {
  const polygons: Array<Array<Array<[number, number]>>> = []
  for (const stroke of strokes) {
    const ring = strokeToRing(stroke, brushRadiusM)
    if (ring && ring.length >= 4) {
      polygons.push([ring])
    }
  }
  if (!polygons.length) {
    return null
  }
  return { type: 'MultiPolygon', coordinates: polygons }
}

/**
 * Посчитать точки во всей заливке (для лимита бэка).
 *
 * @param geometry заливка
 * @returns число точек
 */
export function countGeometryPoints(geometry: DistrictGeometry): number {
  let total = 0
  for (const polygon of geometry.coordinates ?? []) {
    for (const ring of polygon ?? []) {
      total += (ring ?? []).length
    }
  }
  return total
}

/**
 * Центроид заливки для фокуса карты.
 *
 * @param geometry заливка
 * @returns центр или null
 */
export function geometryCentroid(geometry: DistrictGeometry): BrushPoint | null {
  let sumLat = 0
  let sumLng = 0
  let total = 0
  for (const polygon of geometry.coordinates ?? []) {
    for (const ring of polygon ?? []) {
      for (const point of ring ?? []) {
        sumLng += Number(point[0])
        sumLat += Number(point[1])
        total++
      }
    }
  }
  if (!total) {
    return null
  }
  return { lat: sumLat / total, lng: sumLng / total }
}

function simplifyRange(points: BrushPoint[], first: number, last: number, tolerance: number, keep: boolean[]): void {
  let maxDist = 0
  let pivot = 0
  for (let i = first + 1; i < last; i++) {
    const dist = perpendicularDistance(points[i], points[first], points[last])
    if (dist > maxDist) {
      maxDist = dist
      pivot = i
    }
  }
  if (maxDist > tolerance) {
    keep[pivot] = true
    simplifyRange(points, first, pivot, tolerance, keep)
    simplifyRange(points, pivot, last, tolerance, keep)
  }
}

function perpendicularDistance(point: BrushPoint, lineStart: BrushPoint, lineEnd: BrushPoint): number {
  const dx = lineEnd.lng - lineStart.lng
  const dy = lineEnd.lat - lineStart.lat
  const denom = Math.sqrt(dx * dx + dy * dy)
  if (!denom) {
    return 0
  }
  return Math.abs(dy * point.lng - dx * point.lat + lineEnd.lng * lineStart.lat - lineEnd.lat * lineStart.lng) / denom
}

function strokeNormal(prev: BrushPoint, next: BrushPoint): { x: number; y: number } {
  const dx = next.lng - prev.lng
  const dy = next.lat - prev.lat
  const len = Math.sqrt(dx * dx + dy * dy)
  if (!len) {
    return { x: 1, y: 0 }
  }
  return { x: -dy / len, y: dx / len }
}

function offsetPoint(center: BrushPoint, normal: { x: number; y: number }, radiusM: number): [number, number] {
  const dLat = (normal.y * radiusM) / EARTH_M_PER_DEG
  const cosLat = Math.cos((center.lat * Math.PI) / 180) || 1
  const dLng = (normal.x * radiusM) / (EARTH_M_PER_DEG * cosLat)
  return [center.lng + dLng, center.lat + dLat]
}

function circleRing(center: BrushPoint, radiusM: number): Array<[number, number]> {
  const ring: Array<[number, number]> = []
  const steps = 20
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    ring.push(offsetPoint(center, { x: Math.cos(angle), y: Math.sin(angle) }, radiusM))
  }
  ring.push(ring[0])
  return ring
}
