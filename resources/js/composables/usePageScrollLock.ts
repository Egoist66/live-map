import { onBeforeUnmount, onMounted } from 'vue'

export function usePageScrollLock() {
  let prevBody = ''
  let prevHtml = ''
  let prevGutter = ''
  onMounted(() => {
    prevBody = document.body.style.overflow
    prevHtml = document.documentElement.style.overflow
    prevGutter = document.documentElement.style.scrollbarGutter
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.scrollbarGutter = 'auto'
  })
  onBeforeUnmount(() => {
    document.body.style.overflow = prevBody
    document.documentElement.style.overflow = prevHtml
    document.documentElement.style.scrollbarGutter = prevGutter
  })
}
