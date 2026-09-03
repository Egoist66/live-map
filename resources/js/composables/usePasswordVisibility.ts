import { ref, computed } from 'vue'

export function usePasswordVisibility(initial = false) {
  const visible = ref(initial)
  const type = computed(() => (visible.value ? 'text' : 'password'))
  const toggle = () => { visible.value = !visible.value }
  return { visible, type, toggle }
}
