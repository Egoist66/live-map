import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Порог свайпа вниз по шапке диалога для закрытия (px).
 */
const SWIPE_CLOSE_PX = 90

/**
 * Максимальный горизонтальный увод, при котором жест ещё считается свайпом вниз.
 */
const SWIPE_MAX_DRIFT_PX = 60

/**
 * Находит кнопку закрытия PrimeVue Dialog внутри маски.
 * Её наличие = диалог закрываемый (`closable`), системные
 * (скринлок, термы, SOS) кнопки не имеют — их не трогаем.
 *
 * @param mask маска диалога `.p-dialog-mask`
 * @returns кнопка `.p-dialog-header-close` или null
 */
function closeButtonOf(mask: HTMLElement): HTMLElement | null {
  return mask.querySelector('.p-dialog-header-close')
}

/**
 * Закрывает диалог так же, как клик по крестику:
 * PrimeVue сам эмитит `update:visible=false`, родитель закроется.
 * Без крестика (нижние шторки без шапки) — синтетический клик
 * по маске: собственный `dismissableMask` PrimeVue решает сам,
 * нам лишь нужен честный путь закрытия.
 *
 * @param mask маска диалога `.p-dialog-mask`
 */
function requestDialogClose(mask: HTMLElement): void {
  const button = closeButtonOf(mask)

  if (button) {
    button.click()
    return
  }

  try {
    const synthetic = new MouseEvent('click', { bubbles: true, cancelable: true })
    ;(synthetic as any).__dlgFallback = true
    mask.dispatchEvent(synthetic)
  } catch {
  }
}

/**
 * Клик по маске мимо диалога — закрыть (если диалог закрываемый).
 * Дублирует нативный `dismissableMask` там, где проп не выставлен.
 */
function onMaskClick(event: MouseEvent): void {
  if ((event as any).__dlgFallback) {
    return
  }
  const mask = event.currentTarget as HTMLElement
  if (event.target !== mask) {
    return
  }
  requestDialogClose(mask)
}

/**
 * Зоны старта свайпа: шапка И ручка-пилюля.
 *
 * Ручка лежит выше шапки соседом, а не ребёнком — слушатель
 * только на шапке свайп от самой пилюли не ловил. Цепляем обе.
 *
 * @param dialog корень `.p-dialog`
 * @returns элементы, за которые тянем вниз
 */
function swipeZonesOf(dialog: HTMLElement): HTMLElement[] {
  const zones: HTMLElement[] = []
  const header = dialog.querySelector<HTMLElement>('.p-dialog-header')

  if (header) {
    zones.push(header)
  }

  const handle = dialog.querySelector<HTMLElement>('.dlg-swipe-handle')

  if (handle && !zones.includes(handle)) {
    zones.push(handle)
  }

  return zones
}

/**
 * Добавляет ручку-«пилюлю» во все закрываемые мобильные шторки:
 * и affordance свайпа вниз, и тач-зона для безшапочных.
 * На десктопе скрыта CSS (`pointer: coarse` only), вёрстку не рвёт.
 * Системным модалкам без крестика (термы, SOS, age-gate) пилюлю
 * не ставим — свайп там всё равно запрещён.
 *
 * @param mask маска диалога `.p-dialog-mask`
 * @param dialog корень `.p-dialog`
 */
function ensureSwipeHandle(mask: HTMLElement, dialog: HTMLElement): void {
  const exists = dialog.querySelector('.dlg-swipe-handle')

  if (exists) {
    return
  }

  if (!closeButtonOf(mask) && dialog.querySelector('.p-dialog-header')) {
    return
  }

  const handle = document.createElement('div')
  handle.className = 'dlg-swipe-handle'
  handle.setAttribute('aria-hidden', 'true')
  dialog.prepend(handle)
}

interface SwipeState {
  startX: number
  startY: number
  dragging: boolean
  dialog: HTMLElement
  zone: HTMLElement
}

/**
 * Вешает на диалог закрытие свайпом вниз за шапку/ручку.
 * Скролл контента не ломаем: жест начинается только в зоне шапки,
 * `preventDefault` — лишь после committed-вертикали вниз.
 *
 * @param mask маска диалога `.p-dialog-mask`
 * @param dialog корень `.p-dialog`
 * @returns функция отписки слушателей
 */
function attachSwipeToClose(mask: HTMLElement, dialog: HTMLElement): () => void {
  ensureSwipeHandle(mask, dialog)
  const zones = swipeZonesOf(dialog)

  if (!zones.length) {
    return () => {}
  }

  const state: SwipeState = { startX: 0, startY: 0, dragging: false, dialog, zone: zones[0] }

  function onTouchStart(event: TouchEvent): void {
    const point = event.touches[0]
    if (!point || event.touches.length !== 1) {
      return
    }
    state.startX = point.clientX
    state.startY = point.clientY
    state.dragging = false
  }

  function onTouchMove(event: TouchEvent): void {
    const point = event.touches[0]
    if (!point || event.touches.length !== 1) {
      return
    }
    const shiftX = point.clientX - state.startX
    const shiftY = point.clientY - state.startY
    const goingDown = shiftY > 12 && shiftY > Math.abs(shiftX) * 1.4
    if (!state.dragging && !goingDown) {
      return
    }
    state.dragging = true
    if (event.cancelable) {
      event.preventDefault()
    }
    const clamped = Math.min(shiftY, 200)
    state.dialog.classList.add('dlg-dragging')
    state.dialog.style.transform = `translateY(${Math.max(clamped, 0)}px)`
  }

  function resetDrag(): void {
    state.dragging = false
    state.dialog.classList.remove('dlg-dragging')
    state.dialog.style.transition = 'transform 0.22s ease'
    state.dialog.style.transform = ''
    window.setTimeout(() => {
      state.dialog.style.transition = ''
    }, 240)
  }

  function onTouchEnd(event: TouchEvent): void {
    if (!state.dragging) {
      return
    }
    const point = event.changedTouches[0]
    const shiftX = point ? Math.abs(point.clientX - state.startX) : SWIPE_MAX_DRIFT_PX + 1
    const shiftY = point ? point.clientY - state.startY : 0
    const swipedDown = shiftY >= SWIPE_CLOSE_PX && shiftX <= SWIPE_MAX_DRIFT_PX
    resetDrag()
    if (swipedDown) {
      requestDialogClose(mask)
    }
  }

  for (const zone of zones) {
    zone.addEventListener('touchstart', onTouchStart, { passive: true })
    zone.addEventListener('touchmove', onTouchMove, { passive: false })
    zone.addEventListener('touchend', onTouchEnd)
    zone.addEventListener('touchcancel', onTouchEnd)
  }

  return () => {
    for (const zone of zones) {
      zone.removeEventListener('touchstart', onTouchStart)
      zone.removeEventListener('touchmove', onTouchMove)
      zone.removeEventListener('touchend', onTouchEnd)
      zone.removeEventListener('touchcancel', onTouchEnd)
    }
  }
}

/**
 * Глобальное закрытие всех PrimeVue Dialog: клик мимо модалки
 * и свайп вниз за шапку/ручку. Подключается один раз в layout.
 *
 * Незакрываемые диалоги (`closable=false`: термы, SOS, age-gate)
 * не имеют крестика — пропускаются. Нативные `dismissableMask`
 * продолжают работать как раньше, дубль-клика нет: повторный
 * клик по крестику закрытого диалога — no-op.
 *
 * @example
 * useGlobalDialogDismiss()
 */
export function useGlobalDialogDismiss() {
  let observer: MutationObserver | null = null
  const seen = new WeakSet<HTMLElement>()
  const cleanups = new WeakMap<HTMLElement, () => void>()

  /**
   * Обрабатывает одну маску: клик мимо + свайп вниз.
   *
   * @param mask маска диалога `.p-dialog-mask`
   */
  function processMask(mask: HTMLElement): void {
    if (seen.has(mask)) {
      return
    }
    seen.add(mask)
    mask.addEventListener('click', onMaskClick)
    const direct = mask.querySelector<HTMLElement>(':scope > .p-dialog')
    const dialog = direct ?? mask.querySelector<HTMLElement>('.p-dialog')
    if (!dialog) {
      cleanups.set(mask, () => mask.removeEventListener('click', onMaskClick))
      return
    }
    const detachSwipe = attachSwipeToClose(mask, dialog)
    cleanups.set(mask, () => {
      mask.removeEventListener('click', onMaskClick)
      detachSwipe()
    })
  }

  /**
   * Снимает слушатели с удалённой из DOM маски.
   *
   * @param mask маска диалога `.p-dialog-mask`
   */
  function releaseMask(mask: HTMLElement): void {
    const cleanup = cleanups.get(mask)
    if (!cleanup) {
      return
    }
    try {
      cleanup()
    } catch { /* noop */ }
    cleanups.delete(mask)
  }

  function scan(root: ParentNode): void {
    const masks = root.querySelectorAll<HTMLElement>('.p-dialog-mask')
    masks.forEach(processMask)
  }

  onMounted(() => {
    try {
      scan(document.body)
      observer = new MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return
            }
            if (node.classList.contains('p-dialog-mask')) {
              processMask(node)
              return
            }
            scan(node)
          })
          record.removedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) {
              return
            }
            if (node.classList.contains('p-dialog-mask')) {
              releaseMask(node)
            }
          })
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
    } catch { /* noop */ }
  })

  onBeforeUnmount(() => {
    try {
      observer?.disconnect()
    } catch { /* noop */ }
    observer = null
  })
}
