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
    syncSystemChrome(isDark)
  }
}

/**
 * Красит системные зоны WebView/браузера в цвет темы.
 *
 * Статус-бар сверху и панель жестов снизу за документом берутся
 * из `theme-color` и фона `<html>`: без синхронизации там остаётся
 * белый, а шапка/низ меню уже тёмные. Держим один цвет.
 *
 * @param isDark true для тёмной темы
 */
function syncSystemChrome(isDark: boolean): void {
  const bg = isDark ? '#0B0F1A' : '#ffffff'
  const root = document.documentElement
  root.style.backgroundColor = bg
  if (document.body) {
    document.body.style.backgroundColor = bg
  }
  const metas = document.querySelectorAll('meta[name="theme-color"]')
  metas.forEach((m) => {
    const media = m.getAttribute('media')
    if (!media) {
      m.setAttribute('content', bg)
    }
  })
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
