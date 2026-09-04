import { ref } from 'vue'

export function useFilterDialog() {
  const open = ref(false)

  function show() {
    open.value = true
  }

  function hide() {
    open.value = false
  }

  return { open, show, hide }
}
