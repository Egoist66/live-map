import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useScreenLock } from '@/composables/useScreenLock'
import { acquireScrollLock, releaseScrollLock } from '@/composables/useScrollLock'

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'])

/**
 * Владелец лока в ref-counted менеджере (см. useScrollLock).
 */
const SCROLL_OWNER = 'screen-lock'

/**
 * Скролл-лок скринлокера.
 *
 * `overflow` захватываем ТОЛЬКО через общий менеджер: свой снапшот
 * `overflow` здесь раньше затирал чужой (модалки/вьюверы) и наоборот —
 * менеджер запоминал наш `hidden` как исходный и при разблокировке
 * возвращал страницу в `overflow: hidden` навсегда (лечилось только
 * перезагрузкой). `position:fixed/top/width/touchAction/overscroll`
 * менеджер не трогает — их храним локально, конфликта нет.
 */

export function useScreenLockScroll() {
  const { locked } = useScreenLock()
  const prev = ref({ bodyOverscroll: '', htmlOverscroll: '', bodyTouch: '', bodyPosition: '', bodyTop: '', bodyWidth: '' })
  const scrollY = ref(0)
  const active = ref(false)

  function isInsideOverlay(target: EventTarget | null) {
    return target instanceof HTMLElement && !!target.closest('[data-lock-overlay]')
  }

  function isEditable(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
  }

  function onWheel(e: WheelEvent) {
    if (!locked.value) return
    if (isInsideOverlay(e.target)) return
    e.preventDefault()
    e.stopPropagation()
  }

  function onTouchMove(e: TouchEvent) {
    if (!locked.value) return
    if (isInsideOverlay(e.target)) return
    e.preventDefault()
    e.stopPropagation()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!locked.value) return
    if (!SCROLL_KEYS.has(e.code) && e.key !== ' ' && e.key !== 'Spacebar') return
    if (isEditable(e.target)) return
    if (isInsideOverlay(e.target)) {
      const el = e.target instanceof HTMLElement ? e.target.closest('[data-lock-scroll]') : null
      if (el) return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  function bindGlobal() {
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    window.addEventListener('keydown', onKeyDown, { capture: true })
  }

  function unbindGlobal() {
    window.removeEventListener('wheel', onWheel, { capture: true } as any)
    window.removeEventListener('touchmove', onTouchMove, { capture: true } as any)
    window.removeEventListener('keydown', onKeyDown, { capture: true } as any)
  }

  function lockBody() {
    if (active.value) return
    active.value = true
    scrollY.value = window.scrollY || 0
    prev.value = {
      bodyOverscroll: (document.body.style as any).overscrollBehavior,
      htmlOverscroll: (document.documentElement.style as any).overscrollBehavior,
      bodyTouch: (document.body.style as any).touchAction,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
    }
    // overflow — только через менеджер: счётчик владельцев вернёт скролл,
    // когда закроются ВСЕ оверлеи (локер + модалки + вьюверы).
    acquireScrollLock(SCROLL_OWNER)
    ;(document.documentElement.style as any).overscrollBehavior = 'none'
    ;(document.body.style as any).overscrollBehavior = 'none'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY.value}px`
    document.body.style.width = '100%'
    ;(document.body.style as any).touchAction = 'none'
  }

  function unlockBody() {
    if (!active.value) return
    active.value = false
    // Сначала отдаём свой голос в менеджере: пока висит чужой оверлей
    // (модалка, leave-transition нашего же оверлея), overflow остаётся hidden.
    releaseScrollLock(SCROLL_OWNER)
    ;(document.documentElement.style as any).overscrollBehavior = prev.value.htmlOverscroll
    ;(document.body.style as any).overscrollBehavior = prev.value.bodyOverscroll
    ;(document.body.style as any).touchAction = prev.value.bodyTouch
    document.body.style.position = prev.value.bodyPosition
    document.body.style.top = prev.value.bodyTop
    document.body.style.width = prev.value.bodyWidth
    window.scrollTo(0, scrollY.value)
  }

  function sync(v: boolean) {
    if (v) {
      lockBody()
      bindGlobal()
    } else {
      unbindGlobal()
      unlockBody()
    }
  }

  onMounted(() => {
    sync(locked.value)
  })

  const stop = watch(locked, (v) => sync(v))

  onBeforeUnmount(() => {
    stop()
    unbindGlobal()
    unlockBody()
  })
}
