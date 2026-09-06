import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useVisualKeyboard(threshold = 80) {
  const keyboardHeight = ref(0)
  const viewportHeight = ref(0)
  const isKeyboardOpen = ref(false)

  function recalc() {
    try {
      const vv = window.visualViewport
      if (vv) {
        viewportHeight.value = vv.height
        const diff = window.innerHeight - vv.height - vv.offsetTop
        const h = diff > threshold ? Math.round(diff) : 0
        keyboardHeight.value = h
        isKeyboardOpen.value = h > 0
      } else {
        keyboardHeight.value = 0
        isKeyboardOpen.value = false
      }
    } catch {
      keyboardHeight.value = 0
      isKeyboardOpen.value = false
    }
  }

  function onFocusIn(e: FocusEvent) {
    const t = e.target as HTMLElement | null
    if (!t) return
    const tag = t.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      setTimeout(recalc, 100)
      setTimeout(recalc, 300)
    }
  }

  function onFocusOut() {
    setTimeout(recalc, 100)
  }

  onMounted(() => {
    recalc()
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', recalc)
      vv.addEventListener('scroll', recalc)
    }
    window.addEventListener('resize', recalc)
    window.addEventListener('orientationchange', recalc)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
  })

  onBeforeUnmount(() => {
    const vv = window.visualViewport
    if (vv) {
      vv.removeEventListener('resize', recalc)
      vv.removeEventListener('scroll', recalc)
    }
    window.removeEventListener('resize', recalc)
    window.removeEventListener('orientationchange', recalc)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
  })

  return { keyboardHeight, viewportHeight, isKeyboardOpen, recalc }
}
