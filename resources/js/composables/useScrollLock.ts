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
 * Проверяет, заблокирован ли сейчас скролл страницы менеджером.
 *
 * @returns true — есть хотя бы один активный владелец лока
 */
export function isScrollLocked(): boolean {
  return owners.size > 0
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
    prevBody = document.body.style.overflow
    prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  owners.set(owner, (owners.get(owner) ?? 0) + 1)
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
    document.body.style.overflow = prevBody
    document.documentElement.style.overflow = prevHtml
  }
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
