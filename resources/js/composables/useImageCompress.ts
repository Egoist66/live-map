import { compressImageFile, MAX_PHOTO_BYTES } from '@/utils/image'

/**
 * Сжатие картинок в Web Worker (OffscreenCanvas) с фолбэком на главный поток.
 *
 * Главный поток не должен кодировать JPEG/WebP 1920px в цикле из 6 шагов —
 * это фризит скролл/карту на слабых телефонах. Воркер делает то же самое,
 * при недоступности (SSR, старый браузер, таймаут) — обычный `compressImageFile`.
 *
 * @returns compressImageFast — дроп-ин замена `compressImageFile`
 * @example
 * const { compressImageFast } = useImageCompress()
 * const small = await compressImageFast(file, 1920, 0.84)
 */
export function useImageCompress() {
  let worker: Worker | null = null
  let seq = 0
  const pending = new Map<number, { resolve: (v: File) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>()

  const isSupported = (): boolean => {
    return typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
  }

  function ensureWorker(): Worker | null {
    if (!isSupported()) {
      return null
    }
    if (worker) {
      return worker
    }
    try {
      worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; blob?: Blob; type?: string; error?: string }>) => {
        const entry = pending.get(event.data.id)
        if (!entry) {
          return
        }
        pending.delete(event.data.id)
        clearTimeout(entry.timer)
        if (event.data.ok && event.data.blob) {
          const ext = event.data.type === 'image/webp' ? 'webp' : 'jpg'
          const base = currentName.replace(/\.[a-z0-9]+$/i, '')
          entry.resolve(new File([event.data.blob], `${base}.${ext}`, { type: event.data.type ?? 'image/jpeg' }))
        } else {
          entry.reject(new Error(event.data.error ?? 'worker-compress-failed'))
        }
      }
      worker.onerror = () => {
        // При падении воркера — честно роняем все ожидания в фолбэк.
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

  let currentName = 'photo.jpg'

  /**
   * Сжать файл: сначала воркер, при ошибке — синхронный путь.
   *
   * @param file исходный файл
   * @param maxSide стартовая длинная сторона
   * @param quality стартовое качество
   * @param maxBytes потолок веса
   * @returns сжатый файл или исходный
   */
  async function compressImageFast(
    file: File,
    maxSide = 1920,
    quality = 0.84,
    maxBytes = MAX_PHOTO_BYTES,
  ): Promise<File> {
    if (!file.type.startsWith('image/') || file.size <= 400 * 1024) {
      return file
    }

    const w = ensureWorker()
    if (!w) {
      return compressImageFile(file, maxSide, quality, maxBytes)
    }

    currentName = file.name || 'photo.jpg'
    const id = ++seq

    try {
      const result = await new Promise<File>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error('worker-timeout'))
        }, 20000)
        pending.set(id, { resolve, reject, timer })
        w.postMessage({ id, file, fileName: file.name, fileType: file.type, maxSide, quality, maxBytes })
      })
      if (result.size < file.size) {
        return result
      }
      return file
    } catch {
      // Воркер недоступен/упал — тихий фолбэк без потери загрузки.
      try {
        return await compressImageFile(file, maxSide, quality, maxBytes)
      } catch {
        return file
      }
    }
  }

  return { compressImageFast, isWorkerSupported: isSupported }
}
