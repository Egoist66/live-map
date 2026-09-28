import { onMounted } from 'vue'
import { router } from '@inertiajs/vue3'
import { acquireScrollLock, isScrollLocked, releaseScrollLock } from '@/composables/useScrollLock'

/**
 * Глобальный страж скролла страницы при открытых модалках.
 *
 * Почему скролл «умирал» после модалок: PrimeVue Dialog/Drawer лочат
 * страницу своим классом `p-overflow-hidden` на `body`, а наш
 * ref-counted менеджер (`useScrollLock`) — инлайновым `overflow`.
 * Если диалог размонтировался открытым (Inertia-навигация, `v-if`,
 * асинхронный чанк) или закрылись два диалога подряд, класс PrimeVue
 * оставался висеть — страница не скроллилась ни на десктопе,
 * ни на мобиле, хотя наш менеджер уже всё отпустил.
 *
 * Страж выводит состояние из фактического DOM: есть маска диалога
 * или фулскрин-оверлей — скролл залочен, масок нет — принудительно
 * сносим и наш лок, и осиротевший класс PrimeVue. Дополнительно
 * пересверяемся на каждую Inertia-навигацию (кейс «ушли со страницы
 * с открытой модалкой»).
 *
 * Синглтон: стартует один раз на всё время жизни приложения
 * (из `useAppBoot`), повторные вызовы — no-op. Поэтому покрывает
 * и гостевые layout'ы, где модалки тоже есть (PWA-баннеры).
 *
 * @example
 * ```ts
 * // в useAppBoot (без компонентного контекста):
 * startGlobalDialogScrollLock()
 * // или в layout:
 * useGlobalDialogScrollLock()
 * ```
 */

const OWNER = 'global-dialogs'

const MODAL_MASK_SELECTOR = '.p-dialog-mask, .p-drawer-mask'

let started = false
let locked = false
let observer: MutationObserver | null = null
let inertiaOff: Array<() => void> = []

/**
 * Проверяет, есть ли открытая модалка в DOM.
 *
 * @returns true — маска PrimeVue или фулскрин-оверлей на месте
 */
function hasOpenModal(): boolean {
  try {
    if (document.querySelector(MODAL_MASK_SELECTOR)) {
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
 * Сносит осиротевшие блокировки PrimeVue, если модалок в DOM уже нет.
 *
 * Трогаем только класс `p-overflow-hidden` (его ставит сам PrimeVue,
 * других владельцев у класса нет) и инлайновый `overflow: hidden`,
 * когда наш менеджер никого не держит — иначе убьём чужой лок
 * (вьювер фото, превью аватара, чат).
 */
function sweepPrimeVueLeftovers(): void {
  if (hasOpenModal()) {
    return
  }

  for (const el of [document.body, document.documentElement]) {
    el.classList.remove('p-overflow-hidden')
  }

  if (!isScrollLocked()) {
    if (document.body.style.overflow === 'hidden') {
      document.body.style.overflow = ''
    }

    if (document.documentElement.style.overflow === 'hidden') {
      document.documentElement.style.overflow = ''
    }
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
  acquireScrollLock(OWNER)
}

/**
 * Возвращает скролл, только если блокировали мы.
 */
function unlock(): void {
  if (!locked) {
    return
  }

  locked = false
  releaseScrollLock(OWNER)
}

/**
 * Сверяет лок с фактическим DOM и чистит хвосты PrimeVue.
 */
function sync(): void {
  if (typeof document === 'undefined') {
    return
  }

  if (hasOpenModal()) {
    lock()
    return
  }

  unlock()
  sweepPrimeVueLeftovers()
}

/**
 * Запускает глобального стража (идемпотентно).
 *
 * Без компонентного контекста — можно звать из `useAppBoot`.
 * На сервере (SSR) — no-op.
 */
export function startGlobalDialogScrollLock(): void {
  if (started || typeof document === 'undefined' || typeof window === 'undefined') {
    return
  }

  started = true

  try {
    sync()
    observer = new MutationObserver(sync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
  } catch {
    // No-op: страж необязательный, визит продолжает жить.
  }

  try {
    inertiaOff = [
      router.on('navigate', sync),
      router.on('finish', sync),
    ]
  } catch {
    inertiaOff = []
  }
}

/**
 * Останавливает стража (нужно только тестам).
 */
export function stopGlobalDialogScrollLock(): void {
  try {
    observer?.disconnect()
  } catch {
    // No-op.
  }

  observer = null

  for (const off of inertiaOff) {
    try {
      off()
    } catch {
      // No-op.
    }
  }

  inertiaOff = []
  unlock()
  started = false
}

/**
 * Хук-обёртка для layout'ов: страж стартует после монтирования.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * useGlobalDialogScrollLock()
 * </script>
 * ```
 */
export function useGlobalDialogScrollLock(): void {
  onMounted(() => {
    startGlobalDialogScrollLock()
  })
}
