import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * Опции жестов зумирования фото.
 */
export interface PhotoZoomOptions {
  /** Максимальный масштаб (по умолчанию 4). */
  maxScale?: number
  /** Масштаб по даблтапу (по умолчанию 2.5). */
  doubleTapScale?: number
  /** Порог свайпа для листания при масштабе 1 (по умолчанию 60px). */
  swipeThresholdPx?: number
  /** Свайп влево при масштабе 1 (следующее фото). */
  onSwipeLeft?: () => void
  /** Свайп вправо при масштабе 1 (предыдущее фото). */
  onSwipeRight?: () => void
}

/**
 * Щипковый зум фото для полноэкранного просмотра.
 *
 * Жесты: pinch двумя пальцами (с фокусом под пальцами), перетаскивание
 * увеличенного фото, колесо мыши на десктопе, двойной тап/клик (1x ↔ крупный),
 * свайп при масштабе 1 для листания (палец на таче, drag левой кнопкой мыши
 * на десктопе). Кнопки `zoomIn/zoomOut/toggle` — для UI.
 * Всё состояние и жесты живут здесь, компонент только биндит `imgStyle`.
 *
 * @param stage элемент-сцена, на который вешаются слушатели жестов
 * @param options лимиты масштаба и колбэки свайпов
 * @returns масштаб, стиль картинки и действия
 * @example
 * const stageRef = ref<HTMLElement | null>(null)
 * const zoom = usePhotoZoom(stageRef, { onSwipeLeft: next })
 * // <div ref="stageRef"><img :style="zoom.imgStyle.value" /></div>
 */
export function usePhotoZoom(stage: Ref<HTMLElement | null>, options: PhotoZoomOptions = {}) {
  const maxScale = options.maxScale ?? 4
  const doubleTapScale = options.doubleTapScale ?? 2.5
  const swipeThreshold = options.swipeThresholdPx ?? 60

  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)
  const gesturing = ref(false)

  const imgStyle = computed(() => ({
    transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
    transition: gesturing.value ? 'none' : 'transform 0.22s ease',
  }))

  function clampScale(value: number): number {
    if (value < 1) {
      return 1
    }
    if (value > maxScale) {
      return maxScale
    }
    return value
  }

  /**
   * Не даёт увеличенному фото уехать за края сцены.
   */
  function clampTranslate(): void {
    const el = stage.value
    if (!el || scale.value <= 1) {
      return
    }
    const overflowX = (el.clientWidth * (scale.value - 1)) / 2
    const overflowY = (el.clientHeight * (scale.value - 1)) / 2
    translateX.value = Math.min(overflowX, Math.max(-overflowX, translateX.value))
    translateY.value = Math.min(overflowY, Math.max(-overflowY, translateY.value))
  }

  /**
   * Сбросить в исходный масштаб 1:1.
   */
  function reset(): void {
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
  }

  /**
   * Приблизить на шаг (кнопка «+»).
   */
  function zoomIn(): void {
    const next = clampScale(scale.value * 1.4)
    if (next === 1) {
      reset()
      return
    }
    scale.value = next
    clampTranslate()
  }

  /**
   * Отдалить на шаг (кнопка «−»).
   */
  function zoomOut(): void {
    const next = clampScale(scale.value / 1.4)
    if (next === 1) {
      reset()
      return
    }
    scale.value = next
    clampTranslate()
  }

  /**
   * Переключить 1x ↔ крупный план (даблклик).
   */
  function toggle(): void {
    if (scale.value > 1.05) {
      reset()
      return
    }
    scale.value = doubleTapScale
    translateX.value = 0
    translateY.value = 0
    clampTranslate()
  }

  function touchDistance(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.hypot(dx, dy)
  }

  function stageCenter(): { x: number; y: number } {
    const rect = stage.value?.getBoundingClientRect()
    if (!rect) {
      return { x: 0, y: 0 }
    }
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }

  let pinchDistance = 0
  let pinchScale = 1
  let pinchMidX = 0
  let pinchMidY = 0
  let panStartX = 0
  let panStartY = 0
  let panBaseX = 0
  let panBaseY = 0
  let swipeStartX = 0
  let swipeStartY = 0
  let tapStartAt = 0
  let lastTapAt = 0
  let wasPinch = false
  let tapMoved = false

  function onTouchStart(event: TouchEvent): void {
    gesturing.value = true
    const touches = Array.from(event.touches)
    if (touches.length === 2) {
      wasPinch = true
      const first = touches[0]
      const second = touches[1]
      pinchDistance = touchDistance(first, second)
      pinchScale = scale.value
      const center = stageCenter()
      pinchMidX = (first.clientX + second.clientX) / 2 - center.x
      pinchMidY = (first.clientY + second.clientY) / 2 - center.y
      return
    }
    if (touches.length === 1 && !wasPinch) {
      const point = touches[0]
      panStartX = point.clientX
      panStartY = point.clientY
      panBaseX = translateX.value
      panBaseY = translateY.value
      swipeStartX = point.clientX
      swipeStartY = point.clientY
      tapStartAt = Date.now()
      tapMoved = false
    }
  }

  function onPinchMove(event: TouchEvent): void {
    const touches = Array.from(event.touches)
    const first = touches[0]
    const second = touches[1]
    if (!first || !second || pinchDistance <= 0) {
      return
    }
    const nextDistance = touchDistance(first, second)
    const nextScale = clampScale(pinchScale * (nextDistance / pinchDistance))
    const center = stageCenter()
    const nextMidX = (first.clientX + second.clientX) / 2 - center.x
    const nextMidY = (first.clientY + second.clientY) / 2 - center.y
    const ratio = nextScale / scale.value
    translateX.value = nextMidX - (pinchMidX - translateX.value) * ratio
    translateY.value = nextMidY - (pinchMidY - translateY.value) * ratio
    pinchMidX = nextMidX
    pinchMidY = nextMidY
    scale.value = nextScale
    clampTranslate()
  }

  function onPanMove(event: TouchEvent): void {
    const touches = Array.from(event.touches)
    const point = touches[0]
    if (!point) {
      return
    }
    const movedX = Math.abs(point.clientX - swipeStartX)
    const movedY = Math.abs(point.clientY - swipeStartY)
    if (movedX > 8 || movedY > 8) {
      tapMoved = true
    }
    if (scale.value <= 1) {
      return
    }
    translateX.value = panBaseX + (point.clientX - panStartX)
    translateY.value = panBaseY + (point.clientY - panStartY)
    clampTranslate()
  }

  function onTouchMove(event: TouchEvent): void {
    event.preventDefault()
    if (event.touches.length >= 2) {
      onPinchMove(event)
      return
    }
    onPanMove(event)
  }

  function fireSwipe(sideways: number, vertical: number): void {
    const dominant = Math.abs(sideways) > Math.abs(vertical) * 1.5
    if (!dominant || Math.abs(sideways) < swipeThreshold) {
      return
    }
    if (sideways < 0) {
      options.onSwipeLeft?.()
      return
    }
    options.onSwipeRight?.()
  }

  function fireDoubleTap(): void {
    const now = Date.now()
    const quickTap = now - tapStartAt < 300 && !tapMoved
    if (!quickTap) {
      return
    }
    const doubleTap = now - lastTapAt < 320
    lastTapAt = now
    if (doubleTap) {
      toggle()
    }
  }

  function onTouchEnd(event: TouchEvent): void {
    if (event.touches.length > 0) {
      if (event.touches.length === 1) {
        const point = event.touches[0]
        panStartX = point.clientX
        panStartY = point.clientY
        panBaseX = translateX.value
        panBaseY = translateY.value
      }
      return
    }
    gesturing.value = false
    if (wasPinch) {
      wasPinch = false
      if (scale.value < 1.02) {
        reset()
      }
      return
    }
    if (scale.value <= 1) {
      const endX = event.changedTouches[0]?.clientX ?? swipeStartX
      const endY = event.changedTouches[0]?.clientY ?? swipeStartY
      const sideways = endX - swipeStartX
      const vertical = endY - swipeStartY
      fireSwipe(sideways, vertical)
      fireDoubleTap()
      reset()
      return
    }
    fireDoubleTap()
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault()
    gesturing.value = false
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15
    const next = clampScale(scale.value * factor)
    if (next === 1) {
      reset()
      return
    }
    scale.value = next
    clampTranslate()
  }

  let mouseDown = false
  let mouseStartX = 0
  let mouseStartY = 0
  let mouseBaseX = 0
  let mouseBaseY = 0

  /**
   * Начало drag мышью: при масштабе 1 тянем кадр к свайпу,
   * при зуме — панорамируем увеличенное фото.
   */
  function onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) {
      return
    }
    mouseDown = true
    mouseStartX = event.clientX
    mouseStartY = event.clientY
    mouseBaseX = translateX.value
    mouseBaseY = translateY.value
    gesturing.value = true
  }

  /**
   * Drag мышью: живое смещение кадра за курсором.
   */
  function onMouseMove(event: MouseEvent): void {
    if (!mouseDown) {
      return
    }
    const shiftX = event.clientX - mouseStartX
    const shiftY = event.clientY - mouseStartY
    if (scale.value <= 1) {
      translateX.value = mouseBaseX + shiftX
      translateY.value = 0
      return
    }
    translateX.value = mouseBaseX + shiftX
    translateY.value = mouseBaseY + shiftY
    clampTranslate()
  }

  /**
   * Конец drag мышью: при масштабе 1 — свайп листания, иначе — кламп пана.
   */
  function onMouseUp(event: MouseEvent): void {
    if (!mouseDown) {
      return
    }
    mouseDown = false
    gesturing.value = false
    const shiftX = event.clientX - mouseStartX
    const shiftY = event.clientY - mouseStartY
    if (scale.value <= 1) {
      fireSwipe(shiftX, shiftY)
      reset()
      return
    }
    clampTranslate()
  }

  function attach(el: HTMLElement): void {
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function detach(el: HTMLElement): void {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchEnd)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  let attachedEl: HTMLElement | null = null

  watch(
    stage,
    (el) => {
      if (attachedEl) {
        detach(attachedEl)
        attachedEl = null
      }
      if (el) {
        attach(el)
        attachedEl = el
      }
    },
    { immediate: true, flush: 'post' },
  )

  onBeforeUnmount(() => {
    if (attachedEl) {
      detach(attachedEl)
      attachedEl = null
    }
  })

  return { scale, imgStyle, reset, zoomIn, zoomOut, toggle }
}
