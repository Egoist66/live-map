import { ref } from 'vue'

/**
 * Сдвиг тоста за пальцем.
 */
interface ToastOffset {
  x: number
  y: number
}

const DISMISS_X = 90
const DISMISS_UP = -70
const DRAG_MIN = 12
const FOLLOW_LIMIT = 140
const EXIT_MS = 220
const SPRING_MS = 250

/**
 * Свайп тоста уведомлений для закрытия (мобилка).
 *
 * Тост едет за пальцем вбок или вверх; за порогом — улетает
 * в сторону жеста и гасится через `onDismiss`. Тап (сдвиг < 12px)
 * работает как раньше. Клик после свайпа подавляется, чтобы тост
 * не открывался вместо закрытия (включая кнопки внутри).
 *
 * Вертикальный скролл страницы не ломается: вниз жест не ведём,
 * `preventDefault` не используется.
 *
 * @returns bindToast (обработчики для `v-on`), toastStyle, shouldOpen
 * @example
 * ```vue
 * <div v-for="t in toasts" :key="t.id" v-on="swipe.bindToast(t, () => remove(t.id))" :style="swipe.toastStyle(t.id)" @click="onToastClick(t)">
 * ```
 */
export function useToastSwipeDismiss() {
  /** Сдвиг за пальцем по id тоста. */
  const offsets = ref<Record<string, ToastOffset>>({})
  /** Финальный улёт по id тоста (transform для анимации выхода). */
  const leaving = ref<Record<string, string>>({})
  /** Возврат на место по id тоста (пружина после недотяга). */
  const returning = ref<Record<string, boolean>>({})
  /** Тосты, чей клик надо съесть (после свайпа). */
  const clickBlocked = new Set<string>()
  /** Таймеры удаления/возврата по id тоста. */
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  let startX = 0
  let startY = 0
  let activeId: string | null = null
  let tracking = false
  let lockedAxis: 'x' | 'y' | null = null

  /**
   * Ключ тоста строкой (id бывают числом).
   *
   * @param id id тоста
   * @returns строковый ключ
   */
  function keyOf(id: unknown): string {
    return String(id ?? '')
  }

  /**
   * Чистит таймер тоста, если был.
   *
   * @param key ключ тоста
   */
  function clearTimer(key: string): void {
    const timer = timers.get(key)

    if (timer) {
      clearTimeout(timer)
      timers.delete(key)
    }
  }

  /**
   * Глушит клик текущего жеста (тап по кнопкам после свайпа).
   */
  function suppressGestureClick(): void {
    try {
      const stop = (e: Event): void => {
        e.stopPropagation()
        e.preventDefault()
      }

      window.addEventListener('click', stop, { capture: true, once: true })
    } catch {
    }
  }

  /**
   * Начало касания: запоминает точку и тост.
   *
   * @param e touch-событие
   * @param id id тоста
   */
  function onTouchStart(e: TouchEvent, id: unknown): void {
    const touch = e.touches[0]

    if (!touch) {
      return
    }

    startX = touch.clientX
    startY = touch.clientY
    activeId = keyOf(id)
    tracking = true
    lockedAxis = null
  }

  /**
   * Движение пальца: вбок или вверх тост едет следом.
   *
   * @param e touch-событие
   * @param id id тоста
   */
  function onTouchMove(e: TouchEvent, id: unknown): void {
    const key = keyOf(id)

    if (!tracking || activeId !== key || leaving.value[key]) {
      return
    }

    const touch = e.touches[0]

    if (!touch) {
      return
    }

    const dx = touch.clientX - startX
    const dy = touch.clientY - startY

    if (lockedAxis === null) {
      const horizontal = Math.abs(dx) > DRAG_MIN && Math.abs(dx) > Math.abs(dy) * 1.2
      const upward = dy < -DRAG_MIN && Math.abs(dy) > Math.abs(dx)

      if (horizontal) {
        lockedAxis = 'x'
      } else if (upward) {
        lockedAxis = 'y'
      } else {
        return
      }
    }

    if (lockedAxis === 'x') {
      const clamped = Math.max(-FOLLOW_LIMIT, Math.min(FOLLOW_LIMIT, dx))
      offsets.value = { ...offsets.value, [key]: { x: clamped, y: 0 } }
      return
    }

    const clamped = Math.max(-FOLLOW_LIMIT, Math.min(0, dy))
    offsets.value = { ...offsets.value, [key]: { x: 0, y: clamped } }
  }

  /**
   * Отпускание: за порогом — улететь и закрыться, иначе пружина назад.
   *
   * @param id id тоста
   * @param onDismiss гасить тост (remove из стора)
   */
  function onTouchEnd(id: unknown, onDismiss: () => void): void {
    const key = keyOf(id)

    if (!tracking || activeId !== key) {
      return
    }

    tracking = false
    activeId = null
    lockedAxis = null

    const offset = offsets.value[key] ?? { x: 0, y: 0 }
    const traveled = Math.max(Math.abs(offset.x), Math.abs(offset.y))

    if (traveled < DRAG_MIN) {
      const fresh = { ...offsets.value }
      delete fresh[key]
      offsets.value = fresh
      return
    }

    suppressGestureClick()
    clickBlocked.add(key)

    const dismiss = Math.abs(offset.x) >= DISMISS_X || offset.y <= DISMISS_UP

    if (!dismiss) {
      const fresh = { ...offsets.value }
      delete fresh[key]
      offsets.value = fresh
      returning.value = { ...returning.value, [key]: true }
      clearTimer(key)
      timers.set(key, setTimeout(() => {
        timers.delete(key)
        const rest = { ...returning.value }
        delete rest[key]
        returning.value = rest
      }, SPRING_MS))
      return
    }

    try {
      if (navigator.vibrate) {
        navigator.vibrate(15)
      }
    } catch {
    }

    const exit = Math.abs(offset.x) >= Math.abs(offset.y)
      ? `translateX(${offset.x >= 0 ? 120 : -120}%)`
      : 'translateY(-120%)'

    leaving.value = { ...leaving.value, [key]: exit }
    clearTimer(key)
    timers.set(key, setTimeout(() => {
      timers.delete(key)
      try {
        onDismiss()
      } catch {
      }
    }, EXIT_MS))
  }

  /**
   * Отмена жеста системой: вернуть тост на место.
   *
   * @param id id тоста
   */
  function onTouchCancel(id: unknown): void {
    const key = keyOf(id)
    tracking = false
    activeId = null
    lockedAxis = null

    const fresh = { ...offsets.value }
    delete fresh[key]
    offsets.value = fresh
  }

  /**
   * Можно ли открывать тост по клику (нет — если это был свайп).
   *
   * @param id id тоста
   * @returns true когда был тап и тост можно открывать
   */
  function shouldOpen(id: unknown): boolean {
    const key = keyOf(id)

    if (!clickBlocked.has(key)) {
      return true
    }

    clickBlocked.delete(key)
    return false
  }

  /**
   * Привязки свайпа для одного тоста.
   *
   * @param toast тост (нужен только id)
   * @param onDismiss гасить тост после улёта
   * @returns объект обработчиков для `v-on`
   */
  function bindToast(toast: { id: unknown }, onDismiss: () => void): Record<string, (e: any) => void> {
    return {
      touchstart: (e: TouchEvent) => onTouchStart(e, toast.id),
      touchmove: (e: TouchEvent) => onTouchMove(e, toast.id),
      touchend: () => onTouchEnd(toast.id, onDismiss),
      touchcancel: () => onTouchCancel(toast.id),
    }
  }

  /**
   * Стиль тоста: следование за пальцем, пружина, улёт.
   *
   * @param id id тоста
   * @returns transform/opacity/transition
   */
  function toastStyle(id: unknown): Record<string, string> {
    const key = keyOf(id)
    const exit = leaving.value[key]

    if (exit) {
      return {
        transform: exit,
        opacity: '0',
        transition: `transform ${EXIT_MS}ms ease, opacity ${EXIT_MS}ms ease`,
      }
    }

    if (returning.value[key]) {
      return {
        transform: 'translate(0px, 0px)',
        opacity: '1',
        transition: `transform ${SPRING_MS}ms cubic-bezier(0.22,1,0.36,1), opacity ${SPRING_MS}ms ease`,
      }
    }

    const offset = offsets.value[key]

    if (!offset) {
      return {}
    }

    const traveled = Math.max(Math.abs(offset.x), Math.abs(offset.y))
    const opacity = Math.max(0.4, 1 - traveled / 220)

    return {
      transform: `translate(${offset.x}px, ${offset.y}px)`,
      opacity: opacity.toFixed(2),
      transition: 'none',
    }
  }

  return { bindToast, toastStyle, shouldOpen }
}
