import { onMounted, onBeforeUnmount, ref } from 'vue'

export function useChatViewport() {
  const keyboardHeight = ref(0)
  const isKeyboardOpen = ref(false)

  function onResize() {
    const vv = window.visualViewport
    if (!vv) return
    const diff = window.innerHeight - vv.height - vv.offsetTop
    keyboardHeight.value = diff > 80 ? diff : 0
    isKeyboardOpen.value = diff > 80
    if (isKeyboardOpen.value) {
      requestAnimationFrame(() => {
        const el = document.getElementById('chat-messages')
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  }

  function onFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      setTimeout(() => {
        const el = document.getElementById('chat-messages')
        if (el) el.scrollTop = el.scrollHeight
      }, 300)
    }
  }

  onMounted(() => {
    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', onResize)
      vv.addEventListener('scroll', onResize)
    } else {
      window.addEventListener('resize', onResize)
    }
    document.addEventListener('focusin', onFocusIn)
  })

  onBeforeUnmount(() => {
    const vv = window.visualViewport
    if (vv) {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    } else {
      window.removeEventListener('resize', onResize)
    }
    document.removeEventListener('focusin', onFocusIn)
  })

  return { keyboardHeight, isKeyboardOpen }
}
