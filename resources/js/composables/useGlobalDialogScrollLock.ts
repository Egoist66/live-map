import { onBeforeUnmount, onMounted } from 'vue'
import { acquireScrollLock, releaseScrollLock } from '@/composables/useScrollLock'

/**
 * Глобальный лок скролла страницы при открытых модалках.
 *
 * Следит за DOM: любая маска PrimeVue Dialog (`.p-dialog-mask`)
 * или фулскрин-оверлей в `body` (`fixed inset-0` через Teleport)
 * блокирует скролл `body`/`html`, закрытие последней модалки —
 * возвращает как было. Счётчик не нужен: состояние выводится
 * из фактического DOM, поэтому вложенные модалки корректны.
 *
 * Сам лок идёт через ref-counted менеджер скролла, поэтому
 * не конфликтует с вьювером фото и превью аватара: скролл
 * вернётся, только когда закроется последний оверлей.
 *
 * Подключается один раз в `AuthenticatedLayout`.
 *
 * @example
 * useGlobalDialogScrollLock()
 */
export function useGlobalDialogScrollLock() {
  const owner = 'global-dialogs'
  let locked = false
  let observer: MutationObserver | null = null

  /**
   * Проверяет, есть ли открытая модалка в DOM.
   *
   * @returns true — маска диалога или фулскрин-оверлей на месте
   */
  function hasOpenModal(): boolean {
    try {
      const dialogMask = document.querySelector('.p-dialog-mask')

      if (dialogMask) {
        return true
      }

      const bodyNodes = Array.from(document.body.children)

      const hasFixedOverlay = bodyNodes.some((node) => {
        if (!(node instanceof HTMLElement)) {
          return false
        }

        const cls = node.className
        const clsText = typeof cls === 'string' ? cls : String(cls ?? '')

        return clsText.includes('fixed') && clsText.includes('inset-0')
      })

      return hasFixedOverlay
    } catch {
      return false
    }
  }

  /**
   * Блокирует скролл страницы через общий менеджер.
   */
  function lock(): void {
    if (locked) {
      return
    }

    locked = true
    acquireScrollLock(owner)
  }

  /**
   * Возвращает скролл, только если блокировали мы.
   */
  function unlock(): void {
    if (!locked) {
      return
    }

    locked = false
    releaseScrollLock(owner)
  }

  /**
   * Сверяет лок с фактическим DOM.
   */
  function sync(): void {
    const open = hasOpenModal()

    if (open) {
      lock()
      return
    }

    unlock()
  }

  onMounted(() => {
    try {
      sync()
      observer = new MutationObserver(sync)
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      })
    } catch {}
  })

  onBeforeUnmount(() => {
    try {
      observer?.disconnect()
    } catch {}

    observer = null
    unlock()
  })
}
