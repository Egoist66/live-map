import type { DistrictGeometry } from '@/types/entities/District'
import { strokesToGeometry as strokesToGeometrySync, strokeToRing as strokeToRingSync, type BrushPoint } from '@/utils/districtGeo'

/**
 * Геометрия кисти UDistrict в Web Worker с фолбэком на синхронный путь.
 *
 * Рисование островка шлёт десятки pointermove в секунду, а RDP-упрощение +
 * offset-кольца на каждом кадре дёргают главный поток. Воркер считает то же
 * самое, при недоступности — обычные функции из `utils/districtGeo`.
 *
 * @returns strokesToGeometryAsync / strokeToRingAsync — дроп-ин замены
 * @example
 * const { strokesToGeometryAsync } = useDistrictGeoWorker()
 * const geometry = await strokesToGeometryAsync(strokes, brushRadiusM)
 */
export function useDistrictGeoWorker() {
  let worker: Worker | null = null
  let seq = 0
  const pending = new Map<number, { resolve: (v: never) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()

  const isSupported = (): boolean => {
    return typeof window !== 'undefined' && typeof Worker !== 'undefined'
  }

  function ensureWorker(): Worker | null {
    if (!isSupported()) {
      return null
    }
    if (worker) {
      return worker
    }
    try {
      worker = new Worker(new URL('../workers/district-geo.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: never; error?: string }>) => {
        const entry = pending.get(event.data.id)
        if (!entry) {
          return
        }
        pending.delete(event.data.id)
        clearTimeout(entry.timer)
        if (event.data.ok) {
          entry.resolve(event.data.result as never)
        } else {
          entry.reject(new Error(event.data.error ?? 'geo-worker-failed'))
        }
      }
      worker.onerror = () => {
        for (const [, entry] of pending) {
          clearTimeout(entry.timer)
          entry.reject(new Error('worker-error'))
        }
        pending.clear()
      }
      return worker
    } catch {
      return null
    }
  }

  function callWorker<T>(payload: Record<string, unknown>): Promise<T> {
    const w = ensureWorker()
    if (!w) {
      return Promise.reject(new Error('worker-unsupported'))
    }
    const id = ++seq
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('worker-timeout'))
      }, 8000)
      pending.set(id, {
        resolve: resolve as (v: never) => void,
        reject,
        timer,
      })
      w.postMessage({ id, ...payload })
    })
  }

  /**
   * Собрать MultiPolygon из мазков (воркер → фолбэк).
   *
   * @param strokes мазки указателя
   * @param brushRadiusM радиус кисти в метрах
   * @returns геометрия или null
   */
  async function strokesToGeometryAsync(strokes: BrushPoint[][], brushRadiusM: number): Promise<DistrictGeometry | null> {
    try {
      const result = await callWorker<DistrictGeometry | null>({ op: 'strokesToGeometry', strokes, brushRadiusM })
      return result
    } catch {
      return strokesToGeometrySync(strokes, brushRadiusM)
    }
  }

  /**
   * Построить кольцо превью мазка (воркер → фолбэк).
   *
   * @param points точки мазка
   * @param brushRadiusM радиус кисти в метрах
   * @returns кольцо [lng,lat] или null
   */
  async function strokeToRingAsync(points: BrushPoint[], brushRadiusM: number): Promise<Array<[number, number]> | null> {
    try {
      const result = await callWorker<Array<[number, number]> | null>({ op: 'strokeToRing', points, brushRadiusM })
      return result
    } catch {
      return strokeToRingSync(points, brushRadiusM)
    }
  }

  return { strokesToGeometryAsync, strokeToRingAsync, isWorkerSupported: isSupported }
}
