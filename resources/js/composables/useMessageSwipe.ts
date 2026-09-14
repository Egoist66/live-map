import { ref } from 'vue'

/**
 * Свайп по сообщению для ответа (как в Telegram/WhatsApp).
 *
 * Горизонтальный жест в любую сторону сдвигает пузырёк и показывает
 * иконку ответа; при отпускании за порогом вызывается `onReply`.
 * Вертикальный скролл не ломается: пока жест вертикальный — сдвиг нулевой,
 * `preventDefault` не используется. Long-press меню не срабатывает при
 * свайпе — его `touchmove` уже отменяет таймер при сдвиге > 12px.
 *
 * @param opts пороги и колбэк ответа
 * @returns привязки жестов, стиль сдвига и склейка обработчиков
 * @example
 * const swipe = useMessageSwipe({ onReply: (m) => reply.startReply(m) })
 * // в шаблоне: <div v-on="swipe.merge(swipe.bindSwipe(m), bindMessage(m))" :style="swipe.swipeStyle(m)">
 */
export function useMessageSwipe(opts: {
  onReply: (m: any) => void
  threshold?: number
  maxOffset?: number
}) {
  const threshold = opts.threshold ?? 55
  const maxOffset = opts.maxOffset ?? 90

  /** Текущий сдвиг по id сообщения. */
  const offsets = ref<Record<number, number>>({})
  /** Сообщение с видимой подсказкой-иконкой ответа. */
  const hintId = ref<number | null>(null)

  let startX = 0
  let startY = 0
  let activeId: number | null = null
  let tracking = false

  /**
   * Сбрасывает визуальный сдвиг сообщения.
   *
   * @param id id сообщения
   */
  function resetOffset(id: number): void {
    delete offsets.value[id]
    if (hintId.value === id) {
      hintId.value = null
    }
  }

  /**
   * Применяет сдвиг с ограничением и включает подсказку.
   *
   * @param id id сообщения
   * @param dx горизонтальный сдвиг пальца
   */
  function applyOffset(id: number, dx: number): void {
    const clamped = Math.max(-maxOffset, Math.min(maxOffset, dx))
    offsets.value = { ...offsets.value, [id]: clamped }
    hintId.value = Math.abs(clamped) > 18 ? id : null
  }

  /**
   * Начало касания: запоминает точку и сообщение.
   *
   * @param e touch-событие
   * @param m сообщение
   */
  function onTouchStart(e: TouchEvent, m: any): void {
    if ((m as any)?.pending || (m as any)?.failed) {
      return
    }
    const t = e.touches[0]
    if (!t) {
      return
    }
    startX = t.clientX
    startY = t.clientY
    activeId = Number(m?.id)
    tracking = true
  }

  /**
   * Движение пальца: горизонтальный жест сдвигает пузырёк.
   *
   * @param e touch-событие
   * @param m сообщение
   */
  function onTouchMove(e: TouchEvent, m: any): void {
    if (!tracking || activeId !== Number(m?.id)) {
      return
    }
    const t = e.touches[0]
    if (!t) {
      return
    }
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    const isHorizontal = Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4
    if (!isHorizontal) {
      return
    }
    applyOffset(Number(m?.id), dx)
  }

  /**
   * Отпускание: за порогом — ответить, иначе вернуть пузырёк.
   *
   * @param m сообщение
   */
  function onTouchEnd(m: any): void {
    if (!tracking || activeId !== Number(m?.id)) {
      return
    }
    tracking = false
    const id = Number(m?.id)
    const dx = offsets.value[id] ?? 0
    activeId = null
    resetOffset(id)
    if (Math.abs(dx) >= threshold) {
      try {
        if (navigator.vibrate) {
          navigator.vibrate(20)
        }
      } catch {}
      opts.onReply(m)
    }
  }

  /**
   * Привязки свайпа для одного сообщения (ключи как у bindMessage).
   *
   * @param m сообщение
   * @returns объект обработчиков для `v-on`
   */
  function bindSwipe(m: any): Record<string, (e: any) => void> {
    return {
      touchstart: (e: TouchEvent) => onTouchStart(e, m),
      touchmove: (e: TouchEvent) => onTouchMove(e, m),
      touchend: () => onTouchEnd(m),
      touchcancel: () => {
        tracking = false
        activeId = null
        resetOffset(Number(m?.id))
      },
    }
  }

  /**
   * Стиль сдвига пузырька при свайпе.
   *
   * @param m сообщение
   * @returns transform для wrapper-сообщения
   */
  function swipeStyle(m: any): Record<string, string> {
    const dx = offsets.value[Number(m?.id)] ?? 0
    if (!dx) {
      return {}
    }
    return { transform: `translateX(${dx}px)` }
  }

  /**
   * Склеивает несколько карт обработчиков `v-on` в одну.
   *
   * Одноимённые события (например `touchstart` у контекстного меню
   * и у свайпа) вызываются по очереди, а не затирают друг друга.
   *
   * @param maps карты обработчиков
   * @returns объединённая карта для `v-on`
   */
  function merge(
    ...maps: Array<Record<string, ((e: any) => void) | undefined>>
  ): Record<string, (e: any) => void> {
    const merged: Record<string, Array<(e: any) => void>> = {}
    for (const map of maps) {
      for (const key of Object.keys(map ?? {})) {
        const fn = map[key]
        if (typeof fn !== 'function') {
          continue
        }
        if (!merged[key]) {
          merged[key] = []
        }
        merged[key].push(fn)
      }
    }
    const out: Record<string, (e: any) => void> = {}
    for (const key of Object.keys(merged)) {
      const fns = merged[key]
      out[key] = (e: any) => {
        for (const fn of fns) {
          fn(e)
        }
      }
    }
    return out
  }

  return { offsets, hintId, bindSwipe, swipeStyle, merge }
}
