import { watch, onBeforeUnmount } from 'vue'

/**
 * Превью аватара: лок body + закрытие по Escape, пока открыто.
 * На сервере (SSR) — no-op: immediate-watcher молча выходит без `window`.
 *
 * @param open геттер флага открытия
 * @param onClose колбэк закрытия по Escape
 */
export function useAvatarPreview(open: () => boolean, onClose: () => void) {
  let prevBody = ''
  let prevHtml = ''
  let locked = false
  function lock() {
    if (locked || typeof document === 'undefined') return
    locked = true
    prevBody = document.body.style.overflow
    prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  function unlock() {
    if (!locked || typeof document === 'undefined') return
    locked = false
    document.body.style.overflow = prevBody
    document.documentElement.style.overflow = prevHtml
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
  watch(open, (v) => {
    if (typeof window === 'undefined') return
    if (v) {
      lock()
      window.addEventListener('keydown', onKey)
    } else {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, { immediate: true })
  onBeforeUnmount(() => {
    unlock()
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey)
  })
}
