import { ref, watch, computed, onMounted } from 'vue'

/**
 * Детерминированный старт для SSR: сервер и первая гидрация всегда
 * видят 'system' + systemDark=false. Реальные значения из localStorage
 * и matchMedia подтягиваются в onMounted (после гидрации), поэтому
 * mismatch в ThemeToggle/hint исключён. Визуально тема не мигает:
 * blade-скрипт в app.blade.php уже выставил .dark до монтирования Vue.
 */
const theme = ref<'light' | 'dark' | 'system'>('system')
const systemDark = ref(false)
let mql: MediaQueryList | null = null
let synced = false

/**
 * Синхронизирует тему с браузером (только клиент, после гидрации).
 */
function syncFromBrowser(): void {
  if (typeof window === 'undefined' || synced) return
  synced = true
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark' || stored === 'system') theme.value = stored
  } catch {}
  try {
    mql = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = mql.matches
    mql.addEventListener('change', (e) => {
      systemDark.value = e.matches
      if (theme.value === 'system') apply()
    })
  } catch {}
  apply()
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

watch(theme, (v) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('theme', v)
  } catch {}
  apply()
})

const isDark = computed(() => theme.value === 'dark' || (theme.value === 'system' && systemDark.value))

/**
 * Глобальная синхронизация темы после гидрации (только клиент).
 * Вызывается один раз из app.ts после mount — первая отрисовка
 * уже совпала с SSR, дальше идёт обычный реактивный патч без warning.
 */
export function initTheme(): void {
  if (typeof window === 'undefined' || synced) return
  setTimeout(() => syncFromBrowser(), 0)
}

/**
 * Доступ к теме. Первый вызов в браузере планирует синхронизацию
 * с localStorage/matchMedia после монтирования (без mismatch).
 *
 * @returns тема, флаг тёмной темы и переключатели
 */
export function useTheme() {
  if (typeof window !== 'undefined') {
    try {
      onMounted(() => syncFromBrowser())
    } catch {}
  }
  function setTheme(v: 'light'|'dark'|'system'){ theme.value = v }
  function toggle() { theme.value = isDark.value ? 'light' : 'dark' }
  return { theme, isDark, setTheme, toggle, systemDark }
}
