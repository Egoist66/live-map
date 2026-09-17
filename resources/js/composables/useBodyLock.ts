import { onBeforeUnmount, watch } from 'vue'

/**
 * Блокирует прокрутку body, пока активен флаг (модалки, оверлеи).
 * На сервере (SSR) — no-op: `document` там нет, immediate-watcher молча выходит.
 *
 * @param getActive геттер флага активности
 */
export function useBodyLock(getActive: () => boolean) {
  function apply(active: boolean) {
    if (typeof document === 'undefined') return
    document.body.style.overflow = active ? 'hidden' : ''
    document.documentElement.style.overflow = active ? 'hidden' : ''
  }
  const stop = watch(getActive, (v) => apply(!!v), { immediate: true })
  onBeforeUnmount(() => {
    stop()
    apply(false)
  })
}
