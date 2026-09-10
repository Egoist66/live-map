import { ref } from 'vue'

export function useLongPress(onLong: (payload?: any) => void, delay = 520) {
  const pressing = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let payload: any = null
  let moved = false

  function vibrate() {
    try { if (navigator.vibrate) navigator.vibrate(40) } catch {}
  }

  function start(e: TouchEvent, p?: any) {
    payload = p
    moved = false
    pressing.value = true
    const t = e.touches[0]
    startX = t.clientX
    startY = t.clientY
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      pressing.value = false
      vibrate()
      onLong(payload)
    }, delay)
  }

  function move(e: TouchEvent) {
    if (!timer) return
    const t = e.touches[0]
    if (Math.abs(t.clientX - startX) > 12 || Math.abs(t.clientY - startY) > 12) {
      moved = true
      cancel()
    }
  }

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    pressing.value = false
  }

  function end(e: TouchEvent) {
    if (timer) clearTimeout(timer)
    timer = null
    pressing.value = false
    if (moved) e.preventDefault?.()
  }

  function context(e: MouseEvent, p?: any) {
    e.preventDefault()
    onLong(p ?? payload)
    vibrate()
  }

  function bind(p?: any) {
    return {
      touchstart: (e: TouchEvent) => start(e, p),
      touchmove: move,
      touchend: end,
      touchcancel: cancel,
      contextmenu: (e: MouseEvent) => context(e, p),
    }
  }

  return { pressing, bind, start, move, cancel, end, context }
}
