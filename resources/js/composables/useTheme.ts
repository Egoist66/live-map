import { ref, watch, computed } from 'vue'

const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
const theme = ref<'light' | 'dark' | 'system'>((stored as any) || 'system')
const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(mql?.matches ?? false)

if (mql) {
  mql.addEventListener('change', (e) => { systemDark.value = e.matches; if (theme.value === 'system') apply() })
}

function apply() {
  const isDark = theme.value === 'dark' || (theme.value === 'system' && systemDark.value)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }
}

if (typeof window !== 'undefined') {
  apply()
  watch(theme, (v) => {
    localStorage.setItem('theme', v)
    apply()
  })
}

const isDark = computed(() => theme.value === 'dark' || (theme.value === 'system' && systemDark.value))

export function useTheme() {
  function setTheme(v: 'light'|'dark'|'system'){ theme.value = v }
  function toggle() { theme.value = isDark.value ? 'light' : 'dark' }
  return { theme, isDark, setTheme, toggle, systemDark }
}
