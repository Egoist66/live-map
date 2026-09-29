import { onBeforeUnmount, watch } from 'vue'

/**
 * Централизованный менеджер блокировки скролла страницы.
 *
 * Несколько оверлеев (вьювер фото, превью аватара, маски PrimeVue Dialog,
 * Chat на всю страницу) раньше писали `document.body/html.style.overflow`
 * напрямую и затирали друг друга: один лок запоминал `hidden` чужого лока
 * как «предыдущее состояние» и при закрытии возвращал страницу
 * в `overflow: hidden` — скролл пропадал навсегда.
 *
 * Счётчик владельцев решает это: инлайновые стили трогаем только
 * на переходах 0→1 (захват prev) и 1→0 (возврат prev).
 *
 * @example
 * ```ts
 * acquireScrollLock('photo-viewer')
 * // ...
 * releaseScrollLock('photo-viewer')
 * ```
 */
const owners = new Map<string, number>()

let prevBody = ''
let prevHtml = ''

/**
 * Имя владельца DOM-driven лока (см. `useGlobalDialogScrollLock`).
 * Спасатель (`useScrollRescue`) вправе отобрать лок только у него:
 * функциональные владельцы (`screen-lock`, `page-scroll-lock`, …)
 * живут по своему состоянию, их трогать нельзя.
 */
export const DOM_DIALOG_LOCK_OWNER = 'global-dialogs'

/**
 * Класс блокировки скролла PrimeVue на `body`.
 */
export const BODY_LOCK_CLASS = 'p-overflow-hidden'

/**
 * Значения инлайнового `overflow`, которые означают «заблокировано».
 *
 * @param value текущее значение `overflow`
 * @returns true — скролл заблокирован инлайном
 */
function isLockedOverflow(value: string): boolean {
  const normalized = (value ?? '').trim().toLowerCase()

  return normalized === 'hidden' || normalized === 'clip'
}

/**
 * Проверяет, заблокирован ли сейчас скролл страницы менеджером.
 *
 * @returns true — есть хотя бы один активный владелец лока
 */
export function isScrollLocked(): boolean {
  return owners.size > 0
}

/**
 * Возвращает имена активных владельцев лока (для диагностики и спасателя).
 *
 * @returns массив имён владельцев с ненулевым счётчиком
 */
export function getScrollLockOwners(): string[] {
  return Array.from(owners.keys())
}

/**
 * Захватывает лок скролла от имени владельца. Идемпотентно:
 * повторный захват тем же владельцем увеличивает его счётчик.
 *
 * @param owner уникальное имя владельца (например `'photo-viewer'`)
 */
export function acquireScrollLock(owner: string): void {
  if (typeof document === 'undefined') {
    return
  }

  if (owners.size === 0) {
    prevBody = document.body.style.overflow ?? ''
    prevHtml = document.documentElement.style.overflow ?? ''
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  owners.set(owner, (owners.get(owner) ?? 0) + 1)
}

/**
 * Возвращает инлайновый `overflow`, очищенный от «отравленного» значения.
 *
 * Если первый захват случился, когда инлайн уже был `hidden`/`clip`
 * (гонка со сторонним локом, недоживший рестор, восстановленный PWA-DOM),
 * возврат prev вернул бы страницу в `overflow: hidden` навсегда —
 * скролл пропадал до перезагрузки. Ноль владельцев означает
 * «страница должна скроллиться», поэтому такое prev сбрасываем в `''`.
 *
 * @param value запомненное предыдущее значение `overflow`
 * @returns безопасное значение для восстановления
 */
function sanitizeRestoredOverflow(value: string): string {
  if (isLockedOverflow(value)) {
    return ''
  }

  return value
}

/**
 * Освобождает лок скролла владельца. Скролл возвращается,
 * только когда освобождены ВСЕ владельцы. Освобождение
 * неизвестного владельца — no-op, стили не трогаем.
 *
 * @param owner имя владельца, переданное в `acquireScrollLock`
 */
export function releaseScrollLock(owner: string): void {
  if (typeof document === 'undefined') {
    return
  }

  const count = owners.get(owner)

  if (count === undefined) {
    return
  }

  if (count <= 1) {
    owners.delete(owner)
  } else {
    owners.set(owner, count - 1)
  }

  if (owners.size === 0) {
    document.body.style.overflow = sanitizeRestoredOverflow(prevBody)
    document.documentElement.style.overflow = sanitizeRestoredOverflow(prevHtml)
  }
}

/**
 * Принудительно сбрасывает лок одного владельца, сколько бы
 * захватов у него ни висело. Нужен спасателю (`useScrollRescue`):
 * DOM-driven владелец (`global-dialogs`) иногда не видит закрытие
 * оверлея (прерванный transition, снесённый Teleport) и держит
 * инлайн `hidden` вечно — разбирать его счётчик бесполезно.
 *
 * Функциональных владельцев (`screen-lock`, `page-scroll-lock`, …)
 * вызывать с этой функцией нельзя: их состояние живёт в их хуках.
 *
 * @param owner имя владельца для полного сброса
 */
export function forceReleaseScrollOwner(owner: string): void {
  if (typeof document === 'undefined') {
    return
  }

  if (!owners.has(owner)) {
    return
  }

  owners.delete(owner)

  if (owners.size === 0) {
    document.body.style.overflow = sanitizeRestoredOverflow(prevBody)
    document.documentElement.style.overflow = sanitizeRestoredOverflow(prevHtml)
  }
}

/**
 * Проверяет, заблокирован ли скролл инлайновым `overflow` прямо сейчас
 * (вне зависимости от счётчика владельцев — ловит и сторонние записи).
 *
 * @returns true — `body` или `html` стоят в инлайновом `hidden`/`clip`
 */
export function isPageScrollLockedInline(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const bodyOverflow = document.body.style.overflow ?? ''
  const htmlOverflow = document.documentElement.style.overflow ?? ''

  return isLockedOverflow(bodyOverflow) || isLockedOverflow(htmlOverflow)
}

/**
 * Связывает лок скролла с реактивным флагом: пока флаг truthy —
 * лок захвачен, иначе — освобождён. При размонтировании компонента
 * лок гарантированно освобождается (один раз).
 *
 * @param getActive геттер флага активности
 * @param owner имя владельца для менеджера
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * useScrollLock(() => !!gallery.viewerOpen?.value, 'photo-viewer')
 * </script>
 * ```
 */
export function useScrollLock(getActive: () => boolean, owner = 'scroll-lock'): void {
  let held = false

  const stop = watch(
    getActive,
    (active) => {
      if (active && !held) {
        held = true
        acquireScrollLock(owner)
      } else if (!active && held) {
        held = false
        releaseScrollLock(owner)
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stop()

    if (held) {
      held = false
      releaseScrollLock(owner)
    }
  })
}
