import type { DistrictGeometry } from '@/types/entities/District'
import { countGeometryPoints } from '@/utils/districtGeo'

/**
 * Черновик заливки кисти между картой и страницей создания.
 *
 * Карта пишет геометрию в sessionStorage, страница /districts/create
 * читает её: переживает Inertia-переход, умирает вместе с вкладкой.
 */
const DRAFT_KEY = 'upin.district.draft.v1'

/**
 * Черновик заливки: геометрия + служебные поля.
 */
export interface DistrictDraft {
  /** GeoJSON-заливка из мазков кисти. */
  geometry: DistrictGeometry
  /** Сколько мазков в заливке (для подписи). */
  strokesCount: number
  /** Когда нарисовано (ISO). */
  createdAt: string
}

/**
 * Сохранить черновик заливки.
 *
 * @param geometry заливка из useDistrictPaint
 * @param strokesCount число мазков
 */
export function saveDistrictDraft(geometry: DistrictGeometry, strokesCount: number): void {
  try {
    const draft: DistrictDraft = {
      geometry,
      strokesCount,
      createdAt: new Date().toISOString(),
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {}
}

/**
 * Прочитать черновик заливки.
 *
 * @returns черновик или null (карта не рисовалась / вкладка новая)
 */
export function loadDistrictDraft(): DistrictDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as DistrictDraft
    const points = parsed?.geometry ? countGeometryPoints(parsed.geometry) : 0
    const hasPolygons = (parsed?.geometry?.coordinates ?? []).length > 0
    if (!hasPolygons || points === 0) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Удалить черновик (после создания района).
 */
export function clearDistrictDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {}
}
