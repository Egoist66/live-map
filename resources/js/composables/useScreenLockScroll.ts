import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useScreenLock } from '@/composables/useScreenLock'

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'])

export function useScreenLockScroll() {
  const { locked } = useScreenLock()
  const prev = ref({ bodyOverflow: '', htmlOverflow: '', bodyOverscroll: '', htmlOverscroll: '', bodyTouch: '', bodyPosition: '', bodyTop: '', bodyWidth: '' })
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
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverscroll: (document.body.style as any).overscrollBehavior,
      htmlOverscroll: (document.documentElement.style as any).overscrollBehavior,
      bodyTouch: (document.body.style as any).touchAction,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width,
    }
    document.documentElement.style.overflow = 'hidden'
    ;(document.documentElement.style as any).overscrollBehavior = 'none'
    document.body.style.overflow = 'hidden'
    ;(document.body.style as any).overscrollBehavior = 'none'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY.value}px`
    document.body.style.width = '100%'
    ;(document.body.style as any).touchAction = 'none'
  }

  function unlockBody() {
    if (!active.value) return
    active.value = false
    document.documentElement.style.overflow = prev.value.htmlOverflow
    ;(document.documentElement.style as any).overscrollBehavior = prev.value.htmlOverscroll
    document.body.style.overflow = prev.value.bodyOverflow
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
