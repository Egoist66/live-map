import { ref, watch, computed } from 'vue'

const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
const theme = ref<'light' | 'dark' | 'system'>((stored as any) || 'system')
const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const systemDark = ref(mql?.matches ?? false)

if (mql) {
  mql.addEventListener('change', (e) => { systemDark.value = e.matches; if (theme.value === 'system') apply() })
}

/**
 * Применяет тему к документу и красит системный хром.
 *
 * @param isDark true для тёмной темы
 */
function apply() {
  const isDark = theme.value === 'dark' || (theme.value === 'system' && systemDark.value)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
    syncSystemChrome(isDark)
  }
}

/**
 * Сообщает нативному WebView-хосту текущую тему (RN-мост).
 *
 * @param isDark true для тёмной темы
 * @param bg цвет фона системных зон
 */
function notifyNativeTheme(isDark: boolean, bg: string): void {
  try {
    const w = window as unknown as {
      ReactNativeWebView?: { postMessage: (msg: string) => void }
    }
    if (!w?.ReactNativeWebView?.postMessage) return
    w.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'theme', isDark, theme: isDark ? 'dark' : 'light', bg, color: bg }),
    )
    w.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'theme-color', color: bg, isDark }),
    )
  } catch {}
}

/**
 * Красит системные зоны WebView/браузера в цвет темы.
 *
 * Статус-бар сверху и панель жестов снизу за документом берутся
 * из `theme-color` и фона `<html>`: без синхронизации там остаётся
 * белый, а шапка/низ меню уже тёмные. Тёмный фон — #0F121F
 * в цвет нативного шелла upin-mobile (SafeArea/StatusBar/NavigationBar).
 *
 * @param isDark true для тёмной темы
 */
function syncSystemChrome(isDark: boolean): void {
  const bg = isDark ? '#0F121F' : '#ffffff'
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
  notifyNativeTheme(isDark, bg)
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
