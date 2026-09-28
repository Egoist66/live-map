import { router } from '@inertiajs/vue3'

/**
 * Класс блокировки скролла PrimeVue на body.
 */
const BODY_LOCK_CLASS = 'p-overflow-hidden'

/**
 * Селекторы оверлеев PrimeVue, которые легитимно держат блокировку.
 */
const HOLDER_SELECTORS = ['.p-dialog', '.p-drawer', '.p-sidebar']

/**
 * Селекторы масок, которые без держателя внутри — осиротевшие
 * (невидимый fixed-слой ловит wheel/тачи, страница не скроллится,
 * хотя скроллбар на месте).
 */
const MASK_SELECTORS = ['.p-dialog-mask', '.p-drawer-mask', '.p-sidebar-mask']

let bound = false

/**
 * Проверить, есть ли в DOM открытый диалог/дроувер.
 *
 * @returns true, если блокировка скролла легитимна
 */
function hasLockHolder(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  return HOLDER_SELECTORS.some((selector) => document.querySelector(selector) !== null)
}

/**
 * Убрать осиротевшие маски (fixed-слой без диалога внутри).
 */
function removeOrphanMasks(): void {
  for (const selector of MASK_SELECTORS) {
    const masks = document.querySelectorAll<HTMLElement>(selector)

    masks.forEach((mask) => {
      const hasHolder = HOLDER_SELECTORS.some((holder) => mask.querySelector(holder) !== null)

      if (!hasHolder) {
        mask.remove()
      }
    })
  }
}

/**
 * Спасатель скролла: PrimeVue Dialog/Drawer не снимают `p-overflow-hidden`
 * в `beforeUnmount`, поэтому навигация с открытой модалкой (или снос
 * поддерева по `v-if`) навсегда лочит body — страница не скроллится.
 *
 * Чиним только когда держателей блокировки в DOM уже нет: чужую
 * легитимную блокировку не трогаем. Вызывать один раз на буте,
 * дальше работает на каждой Inertia-навигации.
 *
 * @returns void
 * @example initScrollRescue()
 */
export function initScrollRescue(): void {
  if (bound || typeof document === 'undefined' || typeof window === 'undefined') {
    return
  }

  bound = true

  router.on('navigate', () => {
    try {
      if (hasLockHolder()) {
        return
      }

      document.body.classList.remove(BODY_LOCK_CLASS)
      removeOrphanMasks()
    } catch {
      // No-op: спасатель необязательный, визит продолжает жить.
    }
  })
}
