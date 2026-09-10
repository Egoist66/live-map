import { ref, computed } from 'vue'

/**
 * Позиционирование аватара перед загрузкой.
 *
 * Держит исходник, фокус (0-100) и зум (1-3), считает рамку
 * в процентах от квадрата — превью в компоненте совпадает
 * с экспортом в `exportCropped` один в один.
 * @returns состояние кропа и helpers
 * @example
 * const crop = useAvatarCropper()
 * await crop.openWithFile(file)
 * const cropped = await crop.exportCropped()
 */
export function useAvatarCropper() {
  const sourceUrl = ref<string | null>(null)
  const sourceName = ref('avatar.jpg')
  const naturalWidth = ref(0)
  const naturalHeight = ref(0)
  const posX = ref(50)
  const posY = ref(50)
  const zoom = ref(1)
  const shape = ref<'square' | 'circle'>('square')
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
    sourceName.value = file.name || 'avatar.jpg'
    posX.value = 50
    posY.value = 50
    zoom.value = 1
    shape.value = 'square'
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
   * Стиль картинки внутри квадратной рамки в процентах:
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
    if (w >= h) {
      baseW = (w / h) * 100
    } else {
      baseH = (h / w) * 100
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

  /**
   * Переключает форму рамки превью: квадрат или круг.
   * @param v новая форма
   */
  function setShape(v: 'square' | 'circle') {
    shape.value = v
  }

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
    const dy = e.clientY - dragStartY
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
    shape.value = 'square'
  }

  /**
   * Экспортирует квадратный кроп по тем же формулам, что и превью.
   * @param outputSide сторона квадрата в px
   * @returns квадратный jpeg-файл или null
   */
  async function exportCropped(outputSide = 640): Promise<File | null> {
    const url = sourceUrl.value
    const w = naturalWidth.value
    const h = naturalHeight.value
    if (!url || !w || !h) return null
    const px = posX.value
    const py = posY.value
    const z = zoom.value
    const img = await loadImage(url)
    if (!img) return null
    const cover = Math.max(outputSide / w, outputSide / h)
    const dwTotal = w * cover * z
    const dhTotal = h * cover * z
    const exW = dwTotal - outputSide
    const exH = dhTotal - outputSide
    const scale = cover * z
    const sx = (exW * px) / 100 / scale
    const sy = (exH * py) / 100 / scale
    const sw = outputSide / scale
    const sh = outputSide / scale
    const canvas = document.createElement('canvas')
    canvas.width = outputSide
    canvas.height = outputSide
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, outputSide, outputSide)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputSide, outputSide)
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
    if (!blob) return null
    const base = sourceName.value.replace(/\.[a-z0-9]+$/i, '') || 'avatar'
    return new File([blob], `${base}-crop.jpg`, { type: 'image/jpeg' })
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
    sourceUrl,
    posX,
    posY,
    zoom,
    shape,
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
    setShape,
    close,
    setFrameEl,
    reset,
    exportCropped,
  }
}
