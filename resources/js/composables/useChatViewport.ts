import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

/**
 * Отступ клавиатуры для чата на мобилке.
 *
 * Высота применяется только когда фокус в поле сообщения (`[data-chat-input]`),
 * чтобы фокус в поиске по чатам не дёргал весь фрейм и не прятал инпут.
 *
 * @example
 * const { keyboardHeight, isChatKeyboardOpen } = useChatViewport()
 */
export function useChatViewport() {
  const keyboardHeight = ref(0)
  const isKeyboardOpen = ref(false)
  const chatInputFocused = ref(false)

  /**
   * Проверяет, что фокус внутри поля сообщения чата.
   *
   * @param target элемент в фокусе
   * @returns true если это поле сообщения
   */
  function isChatInput(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    if (!el || typeof (el as HTMLElement).closest !== 'function') {
      return false
    }
    return !!(el as HTMLElement).closest('[data-chat-input]')
  }

  /**
   * Высота клавиатуры видна только для поля сообщения.
   */
  const isChatKeyboardOpen = computed(() => isKeyboardOpen.value && chatInputFocused.value)

  function scrollMessagesToBottom(): void {
    requestAnimationFrame(() => {
      const el = document.getElementById('chat-messages')
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  function onResize() {
    const vv = window.visualViewport
    if (!vv) return
    const diff = window.innerHeight - vv.height - vv.offsetTop
    keyboardHeight.value = diff > 80 ? diff : 0
    isKeyboardOpen.value = diff > 80
    if (isChatKeyboardOpen.value) {
      scrollMessagesToBottom()
    }
  }

  function onFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      return
    }
    chatInputFocused.value = isChatInput(e.target)
    if (!chatInputFocused.value) {
      return
    }
    setTimeout(() => {
      if (chatInputFocused.value) scrollMessagesToBottom()
    }, 300)
  }

  function onFocusOut(e: FocusEvent) {
    if (isChatInput(e.target)) {
      chatInputFocused.value = false
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
    document.addEventListener('focusout', onFocusOut)
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
    document.removeEventListener('focusout', onFocusOut)
  })

  return { keyboardHeight, isKeyboardOpen, isChatKeyboardOpen, chatInputFocused }
}
