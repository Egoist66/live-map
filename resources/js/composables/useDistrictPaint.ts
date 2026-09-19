import { computed, onBeforeUnmount, ref } from 'vue'
import { strokesToGeometry, type BrushPoint } from '@/utils/districtGeo'
import { useDistrictGeoWorker } from '@/composables/useDistrictGeoWorker'

/**
 * Кисть UDistrict: заливка куска карты мазками.
 *
 * Десктоп: зажать Alt и вести мышью с левой кнопкой.
 * Мобилка/WebView: кнопка-кисть включает режим, дальше веди пальцем.
 * Состояние и мазки — здесь, захват указателя — через attach(map),
 * превью и слой — в useMap, диалог создания — в useMapPage.
 */
export function useDistrictPaint() {
  /** Режим рисования включён (панель кисти видна). */
  const painting = ref(false)
  /** Alt сейчас зажат (десктоп-триггер кисти). */
  const altHeld = ref(false)
  /** Размер кисти в метрах (S/M/L из панели). */
  const brushRadiusM = ref(220)
  /** Готовые мазки текущего черновика. */
  const strokes = ref<BrushPoint[][]>([])
  /** Мазок, который ведут прямо сейчас. */
  const currentStroke = ref<BrushPoint[] | null>(null)

  /** Кисть вооружена: мазки идут на карту, а не клики. */
  const armed = computed(() => painting.value && (altHeld.value || touchPaint.value))
  /** Рисование пальцем/мышью без клавиатуры (мобильный контрол). */
  const touchPaint = ref(false)

  /** Заливка-черновик для превью на карте. */
  const draftGeometry = computed(() => {
    const all = [...strokes.value]
    if (currentStroke.value?.length) {
      all.push(currentStroke.value)
    }
    if (!all.length) {
      return null
    }
    return strokesToGeometry(all, brushRadiusM.value)
  })

  const { strokesToGeometryAsync } = useDistrictGeoWorker()

  const strokesCount = computed(() => strokes.value.length + (currentStroke.value?.length ? 1 : 0))
  const canUndo = computed(() => strokes.value.length > 0 && !currentStroke.value)
  const canFinish = computed(() => strokes.value.length > 0 && !currentStroke.value)

  /**
   * Войти в режим UDistrict-рисования (только из хаба UDistrict).
   *
   * На тачскринах кисть сразу вооружена пальцем, на десктопе
   * мазки идут только с зажатым Alt — обычные драги панорамят карту.
   */
  function startPainting(): void {
    painting.value = true
    touchPaint.value = isCoarsePointer()
    altHeld.value = false
    strokes.value = []
    currentStroke.value = null
  }

  /**
   * Тачскрин ли (палец вместо Alt).
   */
  function isCoarsePointer(): boolean {
    try {
      if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
        return true
      }
    } catch {}
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).maxTouchPoints > 0 && !window.matchMedia?.('(pointer: fine)').matches) {
        return true
      }
    } catch {}
    return false
  }

  /**
   * Переключить палец между кистью и панорамированием карты.
   *
   * @param v true — вести пальцем рисует, false — двигает карту
   */
  function setTouchPaint(v: boolean): void {
    touchPaint.value = v
  }

  /**
   * Положить готовый мазок в черновик (точки уже в lngLat).
   *
   * @param points точки мазка
   */
  function addStroke(points: BrushPoint[]): void {
    const clean = (points ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    if (!clean.length) {
      return
    }
    strokes.value = [...strokes.value, clean]
  }

  /**
   * Выйти из режима без сохранения.
   */
  function cancelPainting(): void {
    painting.value = false
    touchPaint.value = false
    altHeld.value = false
    strokes.value = []
    currentStroke.value = null
  }

  /**
   * Забрать готовую заливку и выйти из режима.
   *
   * @returns геометрия черновика или null
   */
  function takeDraft(): ReturnType<typeof strokesToGeometry> {
    const geometry = draftGeometry.value
    cancelPainting()
    return geometry
  }

  /**
   * Забрать готовую заливку через воркер (не фризит UI на больших мазках).
   *
   * Превью `draftGeometry` остаётся синхронным для 60fps, а финальный
   * подсчёт перед сохранением едет в воркер.
   *
   * @returns геометрия черновика или null
   */
  async function takeDraftAsync(): Promise<ReturnType<typeof strokesToGeometry>> {
    const all = [...strokes.value]
    if (currentStroke.value?.length) {
      all.push(currentStroke.value)
    }
    if (!all.length) {
      cancelPainting()
      return null
    }
    const geometry = await strokesToGeometryAsync(all, brushRadiusM.value)
    cancelPainting()
    return geometry
  }

  /**
   * Сменить размер кисти (сеттер для шаблонов).
   *
   * @param v радиус в метрах
   */
  function setBrushRadius(v: number): void {
    if (Number.isFinite(v) && v > 0) {
      brushRadiusM.value = v
    }
  }

  /**
   * Отменить последний мазок.
   */
  function undoStroke(): void {
    strokes.value.pop()
  }

  /**
   * Стереть весь черновик.
   */
  function clearStrokes(): void {
    strokes.value = []
    currentStroke.value = null
  }

  /**
   * Печатает ли пользователь в поле (там Alt+Enter не про кисть).
   */
  function isTypingTarget(target: EventTarget | null): boolean {
    const tag = (target as HTMLElement | null)?.tagName ?? ''
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (target as HTMLElement | null)?.isContentEditable === true
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) {
      return
    }
    if (e.key !== 'Alt' && !e.altKey) {
      return
    }
    if (!painting.value) {
      return
    }
    if (isTypingTarget(e.target)) {
      return
    }
    e.preventDefault()
    altHeld.value = true
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt' || !e.altKey) {
      altHeld.value = false
    }
  }

  function onBlur(): void {
    altHeld.value = false
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
  }

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  })

  return {
    painting,
    armed,
    touchPaint,
    altHeld,
    brushRadiusM,
    strokes,
    currentStroke,
    draftGeometry,
    strokesCount,
    canUndo,
    canFinish,
    setBrushRadius,
    setTouchPaint,
    startPainting,
    cancelPainting,
    takeDraft,
    takeDraftAsync,
    addStroke,
    undoStroke,
    clearStrokes,
  }
}
