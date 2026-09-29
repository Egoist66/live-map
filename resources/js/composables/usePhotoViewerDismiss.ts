import { ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useSwipeToClose } from '@/composables/useSwipeToClose'

/**
 * Минимальный контракт галереи, достаточный для dismiss-логики вьювера.
 */
export interface DismissableGallery {
  /** Реактивный флаг открытого вьювера. */
  viewerOpen?: { value: boolean }
  /** Закрывает вьювер. */
  close: () => void
}

/**
 * Dismiss-логика полноэкранного вьювера фото.
 *
 * Объединяет два способа закрытия:
 * - свайп вниз на мобилке (весь вьювер едет за пальцем через `useSwipeToClose`);
 * - клик по затемнённому бэкдропу вокруг колонки на десктопе (`onBackdropClick`).
 *
 * Свайп intentionally ограничен мобилкой (`max-width: 767px`, граница Tailwind `md`)
 * и не срабатывает, когда лента комментариев проскроллена вниз или фокус
 * в поле ввода — иначе жест конфликтовал бы со скроллом и набором текста.
 *
 * @param gallery галерея с флагом `viewerOpen` и методом `close`
 * @returns рефы корня вьювера и скролл-контейнера + обработчик клика по бэкдропу
 * @example
 * const { viewerRootRef, scrollRef, onBackdropClick } = usePhotoViewerDismiss(props.gallery)
 * // <div ref="viewerRootRef">…<div ref="scrollRef">…</div></div>
 * // <div class="hidden md:block" @click="onBackdropClick" />
 */
export function usePhotoViewerDismiss(gallery: DismissableGallery) {
  const viewerRootRef = ref<HTMLElement | null>(null)
  const scrollRef = ref<HTMLElement | null>(null)
  const isMobile = useMediaQuery('(max-width: 767px)')

  /**
   * Проверяет, печатает ли пользователь прямо сейчас.
   *
   * @returns true, если фокус в поле ввода — свайп-закрытие отключаем
   */
  function isTypingNow(): boolean {
    if (typeof document === 'undefined') {
      return false
    }
    const active = document.activeElement as HTMLElement | null
    if (!active) {
      return false
    }
    const tag = active.tagName
    const isField = tag === 'TEXTAREA' || tag === 'INPUT'
    const isEditable = active.isContentEditable
    return isField || isEditable
  }

  /**
   * Проверяет, проскроллена ли лента комментариев вниз.
   *
   * @returns true, если скролл не вверху — жест отдаём скроллу, а не закрытию
   */
  function isScrolledDown(): boolean {
    const top = scrollRef.value?.scrollTop ?? 0
    return top > 8
  }

  /**
   * Геттер разрешения свайп-закрытия для `useSwipeToClose`.
   *
   * @returns true только на мобилке при открытом вьювере, скролле вверху и вне ввода
   */
  function canSwipeDismiss(): boolean {
    if (!gallery.viewerOpen?.value) {
      return false
    }
    if (!isMobile.value) {
      return false
    }
    if (isScrolledDown()) {
      return false
    }
    if (isTypingNow()) {
      return false
    }
    return true
  }

  /**
   * Закрывает вьювер кликом по бэкдропу (десктоп, область вне колонки).
   */
  function onBackdropClick(): void {
    gallery.close()
  }

  useSwipeToClose(viewerRootRef, {
    onClose: () => gallery.close(),
    enabled: canSwipeDismiss,
  })

  return { viewerRootRef, scrollRef, onBackdropClick }
}
