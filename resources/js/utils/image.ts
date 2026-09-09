/**
 * Утилиты обработки изображений на клиенте.
 * Сжимаем фото до загрузки на сервер, чтобы сетка галереи
 * не тянула многомегабайтные оригиналы.
 */

/** Лимит веса фото после оптимизации: 2.5 МБ. */
export const MAX_PHOTO_BYTES = Math.round(2.5 * 1024 * 1024)

/**
 * Сжимает изображение: ресайз по длинной стороне + webp/jpeg.
 * Маленькие файлы возвращает как есть. Большие дожимает перебором
 * качества и размера, пока не влезут в maxBytes.
 * @param file исходный файл
 * @param maxSide стартовая длинная сторона в px
 * @param quality стартовое качество 0..1
 * @param maxBytes потолок веса в байтах
 * @returns сжатый файл (или исходный, если сжать не вышло)
 * @example
 * const small = await compressImageFile(file)
 */
export async function compressImageFile(
  file: File,
  maxSide = 1600,
  quality = 0.82,
  maxBytes = MAX_PHOTO_BYTES,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= 400 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const targetType = supportsWebp() ? 'image/webp' : 'image/jpeg'
      const ext = targetType === 'image/webp' ? 'webp' : 'jpg'
      const base = file.name.replace(/\.[a-z0-9]+$/i, '')
      const steps: Array<{ side: number; q: number }> = [
        { side: maxSide, q: quality },
        { side: maxSide, q: 0.7 },
        { side: 1280, q: 0.72 },
        { side: 1024, q: 0.7 },
        { side: 800, q: 0.65 },
      ]
      let smallest: File | null = null
      for (const step of steps) {
        const blob = await renderBitmap(bitmap, step.side, targetType, step.q)
        if (!blob) continue
        if (blob.size <= maxBytes) return new File([blob], `${base}.${ext}`, { type: targetType })
        if (!smallest || blob.size < smallest.size) smallest = new File([blob], `${base}.${ext}`, { type: targetType })
      }
      if (smallest && smallest.size < file.size) return smallest
      return file
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}

/**
 * Рендерит битмап в blob заданного размера и качества.
 * @param bitmap декодированное изображение
 * @param maxSide длинная сторона в px
 * @param type mime-тип
 * @param quality качество 0..1
 * @returns blob или null
 */
async function renderBitmap(bitmap: ImageBitmap, maxSide: number, type: string, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvasToBlob(canvas, type, quality)
}

/**
 * Проверяет поддержку webp в canvas.
 * @returns true если webp кодируется
 */
function supportsWebp(): boolean {
  try {
    return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

/**
 * Оборачивает canvas.toBlob в промис.
 * @param canvas канвас с картинкой
 * @param type mime-тип
 * @param quality качество 0..1
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality)
    } catch {
      resolve(null)
    }
  })
}
