import { nextTick } from 'vue'
import { useMentions, type MentionUser } from '@/composables/useMentions'

export function useMentionInput(opts: {
  getText: () => string
  setText: (v: string) => void
}) {
  const mentions = useMentions()
  let lastEl: HTMLInputElement | HTMLTextAreaElement | null = null

  function activeEl(): HTMLInputElement | HTMLTextAreaElement | null {
    try {
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
        return ae as HTMLInputElement | HTMLTextAreaElement
      }
    } catch {}
    return null
  }

  function onInput() {
    const el = activeEl()
    if (el) lastEl = el
    try {
      mentions.detect(opts.getText(), (el ?? lastEl)?.selectionStart ?? opts.getText().length)
    } catch {}
  }

  function onFocus() {
    const el = activeEl()
    if (el) lastEl = el
    onInput()
  }

  function pick(user: MentionUser) {
    try {
      const { text, cursor } = mentions.applyMention(opts.getText(), user)
      opts.setText(text)
      nextTick(() => {
        try {
          const el = lastEl && document.contains(lastEl) ? lastEl : activeEl()
          el?.focus({ preventScroll: true } as any)
          try { el?.setSelectionRange?.(cursor, cursor) } catch {}
        } catch {}
      })
    } catch {}
  }

  function close() {
    try { mentions.close() } catch {}
  }

  return { mentions, onInput, onFocus, pick, close }
}
