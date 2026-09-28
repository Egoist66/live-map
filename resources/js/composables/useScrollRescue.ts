import { router } from '@inertiajs/vue3'
import {
  BODY_LOCK_CLASS,
  DOM_DIALOG_LOCK_OWNER,
  forceReleaseScrollOwner,
  getScrollLockOwners,
  isPageScrollLockedInline,
} from '@/composables/useScrollLock'

/**
 * Селекторы масок PrimeVue, которые легитимно держат блокировку,
 * пока внутри видимый диалог/дроувер.
 */
const MASK_SELECTORS = ['.p-dialog-mask', '.p-drawer-mask', '.p-sidebar-mask']

/**
 * Селекторы контента внутри масок.
 */
const HOLDER_SELECTORS = ['.p-dialog', '.p-drawer', '.p-sidebar']

/**
 * Селекторы кастомных фулскрин-оверлеев, телепортированных в `body`
 * (вьюверы фото, превью аватара, скринлок). Декоративные слои
 * (`aria-hidden`, `pointer-events-none` вроде сплэша мэтча) —
 * не держатели: они не перехватывают жесты.
 */
const CUSTOM_HOLDER_SELECTOR = 'body > [data-lock-scroll], body > div[role="dialog"]:not([aria-hidden="true"])'

/**
 * Сколько мс осиротевшая маска (fixed-слой без видимого диалога внутри)
 * может жить перед сносом. Прикрывает leave-анимацию закрытия:
 * в её время маска ещё в DOM, а диалог уже уезжает.
 */
const ORPHAN_GRACE_MS = 800

/**
 * Дебаунс чистки после DOM-шторма (открытие/закрытие оверлеев).
 */
const CLEANUP_DEBOUNCE_MS = 250

/**
 * Период фонового дозора (ловит залипания без DOM-событий).
 */
const WATCHDOG_INTERVAL_MS = 2500

let bound = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let watchdogTimer: ReturnType<typeof setInterval> | null = null
let observer: MutationObserver | null = null

/**
 * Когда маска впервые замечена сиротой (для grace-периода).
 */
const orphanSince = new WeakMap<HTMLElement, number>()

/**
 * Проверяет, реально ли виден элемент: в DOM, не скрыт через
 * `display`/`visibility` (включая предков до `body`) и имеет размер.
 *
 * Проверки только по классу/наличию в DOM недостаточно: `v-show`,
 * прерванные transition и неудалённые Teleport-корни оставляют
 * невидимые fixed-слои, которые по строке класса выглядят «открытыми»
 * и вечно держат лок скролла.
 *
 * @param el проверяемый элемент
 * @returns true — элемент занимает место на экране
 */
export function isOverlayVisible(el: HTMLElement | null): boolean {
  if (!el) {
    return false
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  if (!el.isConnected) {
    return false
  }

  let node: HTMLElement | null = el

  while (node && node !== document.body) {
    const style = window.getComputedStyle(node)

    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false
    }

    node = node.parentElement
  }

  if (el.getClientRects().length > 0) {
    return true
  }

  return el.offsetWidth > 0 || el.offsetHeight > 0
}

/**
 * Проверяет, есть ли на экране открытый оверлей, который легитимно
 * держит блокировку скролла (модалка PrimeVue, дроувер, фулскрин-вьювер,
 * скринлок). Маска без видимого контента внутри считается держателем
 * только в пределах grace — её добивкой занимается чистка сирот.
 *
 * @returns true — блокировка скролла легитимна, чистить ничего нельзя
 */
export function hasVisibleLockHolder(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false
  }

  for (const maskSelector of MASK_SELECTORS) {
    const masks = document.querySelectorAll<HTMLElement>(maskSelector)

    for (const mask of masks) {
      const inner = HOLDER_SELECTORS.map((selector) => mask.querySelector<HTMLElement>(selector)).find(
        (found) => found !== null && found !== undefined,
      )

      if (inner && isOverlayVisible(inner)) {
        return true
      }

      if (!inner && isOverlayVisible(mask)) {
        const since = orphanSince.get(mask)

        if (since === undefined || Date.now() - since < ORPHAN_GRACE_MS) {
          return true
        }
      }
    }
  }

  const customHolders = document.querySelectorAll<HTMLElement>(CUSTOM_HOLDER_SELECTOR)

  for (const holder of customHolders) {
    if (holder.classList.contains('pointer-events-none')) {
      continue
    }

    if (isOverlayVisible(holder)) {
      return true
    }
  }

  return false
}

/**
 * Сносит осиротевшие маски: fixed-слой без видимого диалога внутри
 * ловит wheel/тачи, и страница не скроллится, хотя скроллбар на месте.
 * Маски в пределах grace-периода не трогаем — идёт анимация закрытия.
 */
function removeOrphanMasks(): void {
  const now = Date.now()

  for (const maskSelector of MASK_SELECTORS) {
    const masks = document.querySelectorAll<HTMLElement>(maskSelector)

    masks.forEach((mask) => {
      const hasVisibleHolder = HOLDER_SELECTORS.some((holderSelector) => {
        const inner = mask.querySelector<HTMLElement>(holderSelector)

        return inner !== null && isOverlayVisible(inner)
      })

      if (hasVisibleHolder) {
        orphanSince.delete(mask)
        return
      }

      const since = orphanSince.get(mask)

      if (since === undefined) {
        orphanSince.set(mask, now)
        return
      }

      if (now - since >= ORPHAN_GRACE_MS) {
        try {
          mask.remove()
        } catch {
          // No-op: маску уже снёс сам PrimeVue/Vue.
        }

        orphanSince.delete(mask)
      }
    })
  }
}

/**
 * Чистит залипшую блокировку скролла, если видимых держателей нет:
 * класс PrimeVue, DOM-driven лок менеджера и бесхозный инлайн `overflow`.
 * Функциональных владельцев (`screen-lock`, `page-scroll-lock`, …) не трогаем —
 * их состояние живёт в их хуках, а их оверлеи видны в `hasVisibleLockHolder`.
 */
export function cleanupStrayScrollLocks(): void {
  if (typeof document === 'undefined') {
    return
  }

  try {
    if (hasVisibleLockHolder()) {
      return
    }

    removeOrphanMasks()

    if (hasVisibleLockHolder()) {
      return
    }

    document.body.classList.remove(BODY_LOCK_CLASS)
    document.documentElement.classList.remove(BODY_LOCK_CLASS)

    const owners = getScrollLockOwners()

    if (owners.includes(DOM_DIALOG_LOCK_OWNER)) {
      forceReleaseScrollOwner(DOM_DIALOG_LOCK_OWNER)
    }

    if (getScrollLockOwners().length === 0 && isPageScrollLockedInline()) {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  } catch {
    // No-op: спасатель необязательный, визит продолжает жить.
  }
}

/**
 * Планирует чистку с дебаунсом: схлопывает шторм мутаций
 * открытия/закрытия оверлея в одну проверку после оседания DOM.
 */
function scheduleCleanup(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null
    cleanupStrayScrollLocks()
  }, CLEANUP_DEBOUNCE_MS)
}

/**
 * Спасатель скролла: PrimeVue Dialog/Drawer снимают `p-overflow-hidden`
 * только в штатном `after-leave`/`beforeUnmount`, а DOM-driven лок
 * (`global-dialogs`) — только когда видит уход маски. Прерванный
 * transition, снесённый Teleport, зависший `fixed inset-0` слой или
 * navigation с открытой модалкой оставляют страницу в вечном локе —
 * на мобиле и в PWA это «невозможно листать».
 *
 * Раньше чистка висела только на Inertia-навигации, и залипание
 * без перехода (открыл/закрыл модалку, дропдаун, шторку) лечилось
 * лишь перезагрузкой. Теперь дозор непрерывный: мутации DOM,
 * возврат во вкладку/PWA, фокус окна и фоновый интервал.
 *
 * Чистим только когда видимых держателей блокировки в DOM уже нет:
 * чужую легитимную блокировку не трогаем. Вызывать один раз на буте.
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
    scheduleCleanup()
  })

  window.addEventListener('pageshow', scheduleCleanup)
  window.addEventListener('focus', scheduleCleanup)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleCleanup()
    }
  })

  try {
    observer = new MutationObserver(() => {
      scheduleCleanup()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
  } catch {
    observer = null
  }

  try {
    watchdogTimer = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }

      cleanupStrayScrollLocks()
    }, WATCHDOG_INTERVAL_MS)

    if (typeof (watchdogTimer as unknown as { unref?: () => void }).unref === 'function') {
      ;(watchdogTimer as unknown as { unref: () => void }).unref()
    }
  } catch {
    watchdogTimer = null
  }
}
