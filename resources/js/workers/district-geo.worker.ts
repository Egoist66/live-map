/**
 * Воркер геометрии кисти UDistrict (вне главного потока).
 *
 * Тяжёлое: Ramer-Douglas-Peucker + построение offset-колец на каждый
 * pointermove при рисовании островка. Протокол:
 * { id, op: 'strokesToGeometry' | 'strokeToRing', strokes?, points?, brushRadiusM }
 * -> { id, ok, result?, error? }
 */
import { strokesToGeometry, strokeToRing } from '../utils/districtGeo'

interface GeoRequest {
  id: number
  op: 'strokesToGeometry' | 'strokeToRing'
  strokes?: Array<Array<{ lat: number; lng: number }>>
  points?: Array<{ lat: number; lng: number }>
  brushRadiusM: number
}

self.onmessage = (event: MessageEvent<GeoRequest>) => {
  const { id, op, strokes, points, brushRadiusM } = event.data
  try {
    if (op === 'strokesToGeometry') {
      const result = strokesToGeometry(strokes ?? [], brushRadiusM)
      self.postMessage({ id, ok: true, result })
      return
    }
    const result = strokeToRing(points ?? [], brushRadiusM)
    self.postMessage({ id, ok: true, result })
  } catch (error) {
    self.postMessage({ id, ok: false, error: (error as Error)?.message ?? 'geo-failed' })
  }
}

export {}
