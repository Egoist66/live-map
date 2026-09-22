import { ref, computed } from 'vue'

/**
 * Позиционирование обложки компании перед загрузкой.
 *
 * Широкий баннер 3:1 (hero кабинета и витрины): большую картинку
 * режем в видимую область — фокус (0-100) drag'ом и зум (1-3).
 * Превью в диалоге совпадает с экспортом в `exportCropped` один в один.
 *
 * @returns состояние кропа и helpers
 * @example
 * const crop = useCoverCropper()
 * await crop.openWithFile(file)
 * const banner = await crop.exportCropped()
 * if (banner) await uploadCoverFile(banner)
 */
export function useCoverCropper() {
  /** Соотношение сторон баннера: ширина к высоте. */
  const RATIO = 3
  /** Экспорт: ширина баннера в px (высота = /3). */
  const OUTPUT_W = 1500
  const OUTPUT_H = 500

  const sourceUrl = ref<string | null>(null)
  const sourceName = ref('cover.jpg')
  const naturalWidth = ref(0)
  const naturalHeight = ref(0)
  const posX = ref(50)
  const posY = ref(50)
  const zoom = ref(1)
  const confirming = ref(false)
  const showCropper = ref(false)
  const frameEl = ref<HTMLElement | null>(null)
  const dragging = ref(false)

  const ZOOM_MIN = 1
  const ZOOM_MAX = 3

  let dragStartX = 0
  let dragStartY = 0
  let dragPosX = 50
  let dragPosY = 50

  function clamp(v: number, min: number, max: number) {
    if (v < min) return min
    if (v > max) return max
    return v
  }

  function revokeSource() {
    if (sourceUrl.value && sourceUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(sourceUrl.value)
    }
    sourceUrl.value = null
  }

  /**
   * Открывает редактор с файлом: сбрасывает фокус/зум, меряет натуральный размер.
   * @param file исходный файл картинки
   */
  async function openWithFile(file: File) {
    revokeSource()
    sourceName.value = file.name || 'cover.jpg'
    posX.value = 50
    posY.value = 50
    zoom.value = 1
    const url = URL.createObjectURL(file)
    sourceUrl.value = url
    showCropper.value = true
    try {
      const size = await readNaturalSize(url)
      naturalWidth.value = size.w
      naturalHeight.value = size.h
    } catch {
      naturalWidth.value = 0
      naturalHeight.value = 0
    }
  }

  /**
   * Читает натуральный размер картинки.
   * @param url objectURL исходника
   * @returns ширина и высота
   */
  function readNaturalSize(url: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => reject(new Error('decode'))
      img.src = url
    })
  }

  /**
   * Стиль картинки внутри рамки 3:1 в процентах:
   * ширина/высота/отступы с учётом cover + фокуса + зума.
   * @returns css для абсолютного img
   */
  const frameStyle = computed(() => {
    const w = naturalWidth.value
    const h = naturalHeight.value
    const z = zoom.value
    if (!w || !h) {
      return { width: '100%', height: '100%', left: '0%', top: '0%' }
    }
    let baseW = 100
    let baseH = 100
    if (w / h >= RATIO) {
      baseW = ((w / h) / RATIO) * 100
    } else {
      baseH = ((h / w) * RATIO) * 100
    }
    const dw = baseW * z
    const dh = baseH * z
    const left = (-(dw - 100) * posX.value) / 100
    const top = (-(dh - 100) * posY.value) / 100
    return {
      width: `${dw}%`,
      height: `${dh}%`,
      left: `${left}%`,
      top: `${top}%`,
    }
  })

  function onPointerDown(e: PointerEvent) {
    if (!sourceUrl.value) return
    dragging.value = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragPosX = posX.value
    dragPosY = posY.value
    try {
      (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
    } catch {}
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.value) return
    const box = frameEl.value?.clientWidth || 0
    if (!box) return
    const style = frameStyle.value
    const dw = parseFloat(style.width)
    const dh = parseFloat(style.height)
    const dx = e.clientX - dragStartX
    const dy = (e.clientY - dragStartY) * RATIO
    const exW = dw - 100
    const exH = dh - 100
    if (exW > 0.01) {
      posX.value = clamp(dragPosX - ((dx / box) * 100 * 100) / exW, 0, 100)
    }
    if (exH > 0.01) {
      posY.value = clamp(dragPosY - ((dy / box) * 100 * 100) / exH, 0, 100)
    }
  }

  function onPointerUp() {
    dragging.value = false
  }

  function zoomIn() {
    zoom.value = clamp(Math.round((zoom.value + 0.15) * 100) / 100, ZOOM_MIN, ZOOM_MAX)
  }

  function zoomOut() {
    zoom.value = clamp(Math.round((zoom.value - 0.15) * 100) / 100, ZOOM_MIN, ZOOM_MAX)
  }

  function close() {
    showCropper.value = false
    dragging.value = false
  }

  /**
   * Кладёт DOM рамки для drag-математики (вызывается из ref в шаблоне).
   * @param el элемент рамки или null при размонтировании
   */
  function setFrameEl(el: unknown) {
    frameEl.value = el as HTMLElement | null
  }

  function reset() {
    close()
    revokeSource()
    naturalWidth.value = 0
    naturalHeight.value = 0
    posX.value = 50
    posY.value = 50
    zoom.value = 1
    confirming.value = false
  }

  /**
   * Экспортирует баннер 1500×500 по тем же формулам, что и превью.
   * @returns jpeg-файл баннера или null
   */
  async function exportCropped(): Promise<File | null> {
    const url = sourceUrl.value
    const w = naturalWidth.value
    const h = naturalHeight.value
    if (!url || !w || !h) return null
    const px = posX.value
    const py = posY.value
    const z = zoom.value
    const img = await loadImage(url)
    if (!img) return null
    const cover = Math.max(OUTPUT_W / w, OUTPUT_H / h)
    const dwTotal = w * cover * z
    const dhTotal = h * cover * z
    const exW = dwTotal - OUTPUT_W
    const exH = dhTotal - OUTPUT_H
    const scale = cover * z
    const sx = (exW * px) / 100 / scale
    const sy = (exH * py) / 100 / scale
    const sw = OUTPUT_W / scale
    const sh = OUTPUT_H / scale
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_W
    canvas.height = OUTPUT_H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#1e1b4b'
    ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_W, OUTPUT_H)
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88)
    if (!blob) return null
    const base = sourceName.value.replace(/\.[a-z0-9]+$/i, '') || 'cover'
    return new File([blob], `${base}-banner.jpg`, { type: 'image/jpeg' })
  }

  /**
   * Загружает картинку для canvas-экспорта.
   * @param url objectURL исходника
   * @returns элемент картинки или null
   */
  function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = url
    })
  }

  /**
   * Оборачивает canvas.toBlob в промис.
   * @param canvas канвас с кропом
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

  return {
    RATIO,
    OUTPUT_W,
    OUTPUT_H,
    sourceUrl,
    posX,
    posY,
    zoom,
    confirming,
    ZOOM_MIN,
    ZOOM_MAX,
    showCropper,
    frameEl,
    dragging,
    frameStyle,
    openWithFile,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    zoomIn,
    zoomOut,
    close,
    setFrameEl,
    reset,
    exportCropped,
  }
}

export type CoverCropper = ReturnType<typeof useCoverCropper>
