import { onBeforeUnmount, watch } from 'vue'

export function useBodyLock(getActive: () => boolean) {
  function apply(active: boolean) {
    document.body.style.overflow = active ? 'hidden' : ''
    document.documentElement.style.overflow = active ? 'hidden' : ''
  }
  const stop = watch(getActive, (v) => apply(!!v), { immediate: true })
  onBeforeUnmount(() => {
    stop()
    apply(false)
  })
}
