const DEFAULT_MAX_SIDE = 1920
const DEFAULT_QUALITY = 0.82

/**
 * Ужимает картинку перед отправкой на сервер.
 *
 * Фото с телефона весят 3–12 МБ и упираются в `upload_max_filesize`,
 * после чего PHP выкидывает файл и Laravel отвечает 422.
 * Ресайз до 1920px + JPEG дают ~200–500 КБ — проходит всегда.
 *
 * @param file исходный файл картинки
 * @param maxSide максимальная сторона в пикселях
 * @param quality качество JPEG 0–1
 * @returns новый JPEG-файл, готовый к загрузке
 * @throws если файл не читается как картинка (напр. HEIC в Chrome)
 * @example
 * const small = await downscaleImage(picked)
 * form.append('image', small)
 */
export async function downscaleImage(file: File, maxSide: number = DEFAULT_MAX_SIDE, quality: number = DEFAULT_QUALITY): Promise<File> {
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))

  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas недоступен')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  if (typeof bitmap.close === 'function') {
    bitmap.close()
  }

  const blob = await canvasToJpeg(canvas, quality)
  const baseName = file.name.replace(/\.[a-z0-9]+$/i, '') || 'photo'
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}

/**
 * Декодирует файл в битмап для отрисовки на canvas.
 * @param file файл картинки
 * @returns битмап
 * @throws если браузер не умеет декодировать формат
 */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error('Формат картинки не поддерживается браузером')
  }
}

/**
 * Сериализует canvas в JPEG-блоб.
 * @param canvas канвас с картинкой
 * @param quality качество 0–1
 * @returns JPEG-блоб
 * @throws если сериализация не удалась
 */
async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), 'image/jpeg', quality)
  })
  if (!blob) {
    throw new Error('Не вышло сжать картинку')
  }
  return blob
}
