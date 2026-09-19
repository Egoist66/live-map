/**
 * Воркер сжатия изображений (OffscreenCanvas, вне главного потока).
 *
 * Принимает Blob + параметры, перебирает шаги качество/размер
 * (как `compressImageFile` в `utils/image.ts`) и возвращает сжатый Blob.
 * Протокол: { id, file, maxSide, quality, maxBytes } -> { id, ok, blob?, type?, error? }
 */

interface CompressRequest {
  id: number
  file: Blob
  fileName: string
  fileType: string
  maxSide: number
  quality: number
  maxBytes: number
}

const STEPS_FALLBACK = [0.78, 0.8, 0.76, 0.7, 0.65]

async function renderStep(
  bitmap: ImageBitmap,
  side: number,
  type: string,
  q: number,
): Promise<Blob | null> {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  if (typeof OffscreenCanvas === 'undefined') {
    return null
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  try {
    const blob = await canvas.convertToBlob({ type, quality: q })
    return blob
  } catch {
    return null
  }
}

self.onmessage = async (event: MessageEvent<CompressRequest>) => {
  const { id, file, maxSide, quality, maxBytes } = event.data
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const probe = new OffscreenCanvas(1, 1)
      const probeCtx = probe.getContext('2d')
      if (!probeCtx) {
        throw new Error('no-2d-context')
      }

      // Проба webp: OffscreenCanvas может не поддерживать webp в части браузеров.
      let targetType = 'image/jpeg'
      try {
        const test = await probe.convertToBlob({ type: 'image/webp', quality: 0.8 })
        if (test && test.size > 0) {
          targetType = 'image/webp'
        }
      } catch {
        targetType = 'image/jpeg'
      }

      const steps = [
        { side: maxSide, q: quality },
        { side: maxSide, q: STEPS_FALLBACK[0] },
        { side: 1600, q: STEPS_FALLBACK[1] },
        { side: 1280, q: STEPS_FALLBACK[2] },
        { side: 1024, q: STEPS_FALLBACK[3] },
        { side: 800, q: STEPS_FALLBACK[4] },
      ]

      let smallest: Blob | null = null
      for (const step of steps) {
        const blob = await renderStep(bitmap, step.side, targetType, step.q)
        if (!blob) {
          continue
        }
        if (blob.size <= maxBytes) {
          self.postMessage({ id, ok: true, blob, type: targetType })
          return
        }
        if (!smallest || blob.size < smallest.size) {
          smallest = blob
        }
      }

      if (smallest && smallest.size < file.size) {
        self.postMessage({ id, ok: true, blob: smallest, type: targetType })
        return
      }
      self.postMessage({ id, ok: false, error: 'not-smaller' })
    } finally {
      bitmap.close()
    }
  } catch (error) {
    self.postMessage({ id, ok: false, error: (error as Error)?.message ?? 'compress-failed' })
  }
}

export {}
