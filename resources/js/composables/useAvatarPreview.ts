import { watch, onBeforeUnmount } from 'vue'

export function useAvatarPreview(open: () => boolean, onClose: () => void) {
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
  watch(open, (v) => {
    if (v) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', onKey)
    } else {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, { immediate: true })
  onBeforeUnmount(() => {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onKey)
  })
}
