import { computed, nextTick, ref } from 'vue'
import { useVisualKeyboard } from '@/composables/useVisualKeyboard'
import { usePlatform } from '@/composables/usePlatform'

type MentionsLike = {
  detect?: (text: string, cursor: number) => void
  applyMention?: (text: string, u: any) => { text: string; cursor: number }
  close?: () => void
} | null | undefined

export function usePinCommentInput(opts: {
  getText: () => string
  emit: (e: 'update:comment', v: string) => void
  mentions?: MentionsLike
}) {
  const { keyboardHeight, isKeyboardOpen } = useVisualKeyboard()
  const { isNative } = usePlatform()
  const cardRef = ref<HTMLElement | null>(null)
  const listRef = ref<HTMLElement | null>(null)
  const commentInput = ref<any>(null)

  const cardStyle = computed(() => {
    if (isNative) {
      return {}
    }
    const h = keyboardHeight.value
    if (!isKeyboardOpen.value || !h) return {}
    return {
      transform: `translateY(${-h}px)`,
      transition: 'transform 0.22s ease-out',
      willChange: 'transform',
    } as any
  })

  function inputEl(): any {
    try {
      return (commentInput.value as any)?.$el ?? commentInput.value ?? null
    } catch {
      return null
    }
  }

  function resolveInputTag(el: any): HTMLInputElement | HTMLTextAreaElement | null {
    if (!el) return null
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el
    try {
      const inner = el.querySelector?.('input,textarea')
      if (inner) return inner
    } catch {}
    return null
  }

  function inputCursor(): number {
    const el = resolveInputTag(inputEl())
    if (el && typeof el.selectionStart === 'number') return el.selectionStart ?? 0
    return (opts.getText() || '').length
  }

  function focusInput(cursor?: number) {
    const el = resolveInputTag(inputEl())
    if (!el) return
    try {
      el.focus({ preventScroll: true } as any)
      if (typeof cursor === 'number' && (el as any).setSelectionRange) {
        try { (el as any).setSelectionRange(cursor, cursor) } catch {}
      }
    } catch {}
  }

  function ensureVisible() {
    nextTick(() => {
      try {
        const el = resolveInputTag(inputEl())
        el?.scrollIntoView?.({ block: 'nearest' })
      } catch {}
    })
  }

  function onCommentInput(cursor?: unknown, text?: unknown) {
    try {
      const body = typeof text === 'string' ? text : opts.getText()
      const pos = typeof cursor === 'number' ? cursor : inputCursor()
      opts.mentions?.detect?.(body, pos)
    } catch {}
  }

  function onInputFocus() {
    ensureVisible()
    onCommentInput()
  }

  function pickMention(u: any) {
    try {
      if (!opts.mentions?.applyMention) return
      const { text, cursor } = opts.mentions.applyMention(opts.getText(), u)
      opts.emit('update:comment', text)
      nextTick(() => focusInput(cursor))
    } catch {}
  }

  function focusForReply() {
    nextTick(() => {
      focusInput()
      ensureVisible()
    })
    setTimeout(() => focusInput(), 80)
  }

  function blurInput() {
    try { resolveInputTag(inputEl())?.blur?.() } catch {}
    try { (opts.mentions as any)?.close?.() } catch {}
  }

  return {
    cardRef,
    listRef,
    commentInput,
    keyboardHeight,
    isKeyboardOpen,
    cardStyle,
    inputCursor,
    focusInput,
    ensureVisible,
    onCommentInput,
    onInputFocus,
    pickMention,
    focusForReply,
    blurInput,
  }
}
