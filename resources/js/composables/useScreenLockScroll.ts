import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useScreenLock } from '@/composables/useScreenLock'
import { acquireScrollLock, releaseScrollLock, SCREEN_LOCK_OWNER } from '@/composables/useScrollLock'

const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'])

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
    acquireScrollLock(SCREEN_LOCK_OWNER)
    ;(document.documentElement.style as any).overscrollBehavior = 'none'
    ;(document.body.style as any).overscrollBehavior = 'none'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY.value}px`
    document.body.style.width = '100%'
    ;(document.body.style as any).touchAction = 'none'
  }

  function unlockBody() {
    const wasActive = active.value
    active.value = false
    // Свой голос в менеджере отдаём только если захватывали: чужой
    // overflow (модалка под локскрином) не трогаем.
    if (wasActive) {
      releaseScrollLock(SCREEN_LOCK_OWNER)
    }
    // Инлайн-стили — только наши (снапшот в lockBody), поэтому
    // восстанавливаем всегда, даже если active уже false: гонка
    // монтирования/таймеров иначе оставляет body{position:fixed}
    // навсегда — «мёртвая» страница без скролла в Mini App.
    ;(document.documentElement.style as any).overscrollBehavior = prev.value.htmlOverscroll
    ;(document.body.style as any).overscrollBehavior = prev.value.bodyOverscroll
    ;(document.body.style as any).touchAction = prev.value.bodyTouch
    // Снапшот мог захватить чужой/залипший `position:fixed` (повторный
    // mount поверх активного лока, HMR, переживший reload DOM): возврат
    // такого prev заморозит страницу заново — чистим как отравленный.
    const prevStuckFixed = prev.value.bodyPosition === 'fixed'
    document.body.style.position = prevStuckFixed ? '' : prev.value.bodyPosition
    document.body.style.top = prevStuckFixed ? '' : prev.value.bodyTop
    document.body.style.width = prevStuckFixed ? '' : prev.value.bodyWidth
    if (wasActive) {
      window.scrollTo(0, scrollY.value)
    }
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
