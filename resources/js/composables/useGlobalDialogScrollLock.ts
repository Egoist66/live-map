import { onBeforeUnmount, onMounted } from 'vue'
import { router } from '@inertiajs/vue3'
import { acquireScrollLock, DOM_DIALOG_LOCK_OWNER, releaseScrollLock } from '@/composables/useScrollLock'
import { hasVisibleLockHolder } from '@/composables/useScrollRescue'

/**
 * Глобальный лок скролла страницы при открытых модалках.
 *
 * Следит за DOM: видимая маска PrimeVue Dialog/Drawer или фулскрин-оверлей
 * блокирует скролл `body`/`html`, закрытие последнего оверлея —
 * возвращает как было. Состояние выводится из фактического DOM,
 * поэтому вложенные модалки корректны.
 *
 * Видимость держателя проверяет общий `hasVisibleLockHolder`
 * (см. `useScrollRescue`): прежняя эвристика «любой `fixed inset-0`
 * ребёнок `body`» держала лок из-за декоративных слоёв
 * (`pointer-events-none` сплэш мэтча, `aria-hidden` фоны) и невидимых
 * остатков Teleport — страница переставала листаться без видимой причины.
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
  const owner = DOM_DIALOG_LOCK_OWNER
  let locked = false
  let alive = false
  let observer: MutationObserver | null = null
  let scheduled = false

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
   * Сверяет лок с фактическим DOM. После размонтирования — no-op:
   * отложенный `requestAnimationFrame` не должен захватывать лок заново.
   */
  function sync(): void {
    scheduled = false

    if (!alive) {
      return
    }

    let open = false

    try {
      open = hasVisibleLockHolder()
    } catch {
      open = false
    }

    if (open) {
      lock()
      return
    }

    unlock()
  }

  /**
   * Схлопывает шторм мутаций в один синхрон: за открытие/закрытие
   * оверлея прилетают десятки записей (маска, контент, классы, стили).
   */
  function scheduleSync(): void {
    if (scheduled) {
      return
    }

    scheduled = true

    try {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => sync())
        return
      }
    } catch {
      // No-op: ниже — синхронный фолбэк.
    }

    sync()
  }

  function onVisibility(): void {
    try {
      if (document.visibilityState === 'visible') {
        scheduleSync()
      }
    } catch {
      // No-op: необязательный пересчёт.
    }
  }

  /**
   * Навигация Inertia со смонтированной страницей: страничная модалка
   * размонтировалась вместе со страницей, её маска уже ушла из DOM,
   * а наш лок (`global-dialogs`) ещё висит до следующего шторма мутаций —
   * страница после перехода не листается. Синхронный пересчёт по событию
   * навигации закрывает это окно: держателей уже нет — лок отдаём сразу.
   */
  let stopNavigate: (() => void) | null = null
  let stopFinish: (() => void) | null = null

  onMounted(() => {
    try {
      alive = true
      sync()
      observer = new MutationObserver(scheduleSync)
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      })
      window.addEventListener('focus', scheduleSync)
      document.addEventListener('visibilitychange', onVisibility)
      stopNavigate = router.on('navigate', () => sync())
      stopFinish = router.on('finish', () => sync())
    } catch {}
  })

  onBeforeUnmount(() => {
    alive = false

    try {
      observer?.disconnect()
      window.removeEventListener('focus', scheduleSync)
      document.removeEventListener('visibilitychange', onVisibility)
      stopNavigate?.()
      stopFinish?.()
    } catch {}

    stopNavigate = null
    stopFinish = null
    observer = null
    unlock()
  })
}
