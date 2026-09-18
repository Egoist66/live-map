import { watch, onBeforeUnmount } from 'vue'
import { acquireScrollLock, releaseScrollLock } from '@/composables/useScrollLock'

/**
 * Превью аватара: лок body + закрытие по Escape, пока открыто.
 * На сервере (SSR) — no-op: immediate-watcher молча выходит без `window`.
 *
 * Лок идёт через ref-counted менеджер скролла, поэтому превью
 * корректно живёт рядом с вьювером фото и масками Dialog.
 *
 * @param open геттер флага открытия
 * @param onClose колбэк закрытия по Escape
 * @param owner имя владельца лока
 */
export function useAvatarPreview(open: () => boolean, onClose: () => void, owner = 'avatar-preview') {
  let locked = false
  function lock() {
    if (locked || typeof document === 'undefined') return
    locked = true
    acquireScrollLock(owner)
  }
  function unlock() {
    if (!locked || typeof document === 'undefined') return
    locked = false
    releaseScrollLock(owner)
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
