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
/**
 * Энергосбережение (чёрный фон): красит поверхности в true black
 * вместо тёмно-серого. Работает независимо от выбранной темы —
 * при включении сразу даёт чёрный экран (форсит тёмный режим).
 * Отдельный флаг, а не 4-я тема. На `<html>` отражается классом
 * `amoled`, сами цвета — CSS-блоком `html.amoled` в app.css.
 */
const amoled = ref(false)
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
    amoled.value = localStorage.getItem('amoled') === '1'
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
  const baseDark = theme.value === 'dark' || (theme.value === 'system' && systemDark.value)
  const effectiveDark = baseDark || amoled.value
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', effectiveDark)
    document.documentElement.classList.toggle('amoled', amoled.value)
    document.documentElement.style.colorScheme = effectiveDark ? 'dark' : 'light'
    syncSystemChrome(effectiveDark)
  }
}

/**
 * Включает/выключает класс энергосбережения на документе.
 *
 * Класс висит независимо от текущей темы (цвета gated селектором
 * `html.amoled`), тёмный режим при этом форсится в `apply()`,
 * поэтому чёрный экран включается сразу, без отдельной тёмной темы.
 */
function applyAmoledClass(): void {
  if (typeof document === 'undefined') return
  try {
    document.documentElement.classList.toggle('amoled', amoled.value)
  } catch {}
}

/**
 * Подчинить тему сайта цветовой схеме Telegram-клиента.
 *
 * Внутри Mini App нативный хром (шапка, фон) красится палитрой
 * themeParams клиента, а компоненты — классом `dark` сайта. Если их
 * не синхронизировать (клиент светлый, сайт тёмный), получается
 * белый текст на белом фоне: имена в списке чатов не читаются.
 * Поэтому в TG решает клиент: светлый — 'light', тёмный — 'dark'.
 * Вотчер выше сам положит значение в localStorage и перекрасит
 * документ, настройки «Внешний вид» тоже подхватят его реактивно.
 *
 * @param scheme схема Telegram-клиента ('light' | 'dark')
 */
export function syncThemeWithTelegram(scheme: 'light' | 'dark'): void {
  if (theme.value === scheme) {
    return
  }

  theme.value = scheme

  try {
    localStorage.setItem('theme', scheme)
  } catch {
    // No-op: вотчер выше всё равно попробует сохранить.
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
 * Синхронизирует тему с манифестом PWA и cookie.
 *
 * `theme_color` манифеста красит системную панель навигации Android
 * под нижним меню и не умеет читать CSS-тему. Поэтому при каждом
 * переключении темы пишем `ulove_theme` в cookie (её прочитает
 * `/site.webmanifest` при следующем запуске установленного PWA)
 * и обновляем `href` тега manifest — Chrome перечитывает манифест
 * и подтягивает актуальный цвет хрома без переустановки приложения.
 *
 * @returns void
 */
function syncManifestTheme(): void {
  if (typeof document === 'undefined') {
    return
  }

  const theme = amoled.value ? 'amoled' : isDark.value ? 'dark' : 'light'

  try {
    document.cookie = `ulove_theme=${theme}; path=/; max-age=31536000; SameSite=Lax`
  } catch {
    // No-op: без cookie манифест отдаст светлую тему по умолчанию.
  }

  try {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')

    if (!link) {
      return
    }

    const url = new URL(link.href, window.location.origin)

    if (url.searchParams.get('theme') === theme) {
      return
    }

    url.searchParams.set('theme', theme)
    link.href = url.toString()
  } catch {
    // No-op: кривой href не должен ломать применение темы.
  }
}

/**
 * Красит системные зоны WebView/браузера в цвет темы.
 *
 * Статус-бар сверху и панель жестов снизу за документом берутся
 * из `theme-color` и фона `<html>`: без синхронизации там остаётся
 * чужой цвет (бренд из SEO или системный), а шапка/низ меню уже
 * в цвете темы. Тёмный фон — #0F121F в цвет нижней навигации
 * и фона документа, светлый — #ffffff.
 *
 * Красим ВСЕ `meta[name="theme-color"]`, включая варианты с `media`:
 * иначе при наличии media-мет браузер берёт системную схему ОС,
 * а не выбранную в приложении тему, и полосы под навигацией
 * расходятся с баром при принудительной светлой/тёмной теме.
 *
 * Пока жив boot-сплэш (`#pwa-boot`), фон `<html>/<body>` не трогаем:
 * blade-скрипт держит его тёмным (#0B101B), чтобы розовый логотип
 * при opacity-фейде гас над тёмным, а не выцветал в серый над белым.
 * Целевой фон вернёт `__upinHideSplash` в момент удаления узла.
 *
 * @param isDark true для тёмной темы
 */
function syncSystemChrome(isDark: boolean): void {
  const bg = amoled.value ? '#000000' : isDark ? '#0F121F' : '#ffffff'
  const root = document.documentElement
  const bootAlive = typeof document !== 'undefined' && !!document.getElementById('pwa-boot')

  syncManifestTheme()

  if (!bootAlive) {
    root.style.backgroundColor = bg

    if (document.body) {
      document.body.style.backgroundColor = bg
    }
  }
  const metas = document.querySelectorAll('meta[name="theme-color"]')
  metas.forEach((m) => {
    m.setAttribute('content', bg)
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

watch(amoled, (v) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('amoled', v ? '1' : '0')
  } catch {}
  applyAmoledClass()
  apply()
})

const isDark = computed(
  () => theme.value === 'dark' || (theme.value === 'system' && systemDark.value) || amoled.value,
)

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
  function toggle() {
    const baseDark = theme.value === 'dark' || (theme.value === 'system' && systemDark.value)
    theme.value = baseDark ? 'light' : 'dark'
  }
  /**
   * Переключатель энергосбережения (чёрный фон true black).
   *
   * Включение сразу даёт чёрный экран независимо от темы:
   * тёмный режим форсится через `isDark`/`apply()`.
   *
   * @param v true — чёрный фон
   */
  function setAmoled(v: boolean){ amoled.value = !!v }
  return { theme, isDark, setTheme, toggle, systemDark, amoled, setAmoled }
}
