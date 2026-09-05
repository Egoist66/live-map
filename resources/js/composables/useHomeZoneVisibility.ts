import { ref, watch } from 'vue'

const KEY = 'upin.homezone.visible'
const visible = ref(true)
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  try {
    const v = localStorage.getItem(KEY)
    if (v !== null) visible.value = v !== '0'
  } catch {}
}

export function useHomeZoneVisibility() {
  load()
  watch(visible, (v) => {
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch {}
  })
  function toggle(v?: boolean | unknown) {
    visible.value = typeof v === 'boolean' ? v : !visible.value
  }
  function set(v: boolean) {
    visible.value = v
  }
  return { visible, toggle, set }
}
