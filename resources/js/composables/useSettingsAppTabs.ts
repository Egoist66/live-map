import { onBeforeUnmount, ref, watch } from 'vue'

/**
 * Query-параметр активного подтаба: `/settings/app?apptab=stats`.
 *
 * Дефолтный `sections` в URL не пишем — чистый `/settings/app`.
 * Перезагрузка и кнопки браузера восстанавливают подтаб из URL.
 */
export const SETTINGS_APP_TAB_PARAM = 'apptab'

/**
 * Смысловые подтабы раздела «Приложение» в настройках.
 *
 * Раздел разросся в простыню (модули, пуши, установка, Telegram,
 * хоткеи) — каждая смысловая группа живёт на своей
 * подвкладке, компонент `SettingsAppTab` только рисует табы.
 *
 * @returns список подтабов, активный id и переключатель
 * @example
 * const { tabs, active, setActive } = useSettingsAppTabs()
 */
export type SettingsAppTabId = 'sections' | 'notify' | 'stats' | 'install' | 'telegram' | 'hotkeys'

/** Подвкладка раздела «Приложение»: id, подпись, иконка и подсказка. */
export interface SettingsAppTab {
  id: SettingsAppTabId
  label: string
  icon: string
  desc: string
}

export const SETTINGS_APP_TABS: readonly SettingsAppTab[] = [
  { id: 'sections', label: 'Разделы', icon: 'pi pi-th-large', desc: 'Какие разделы видны в меню' },
  { id: 'notify', label: 'Уведомления', icon: 'pi pi-bell', desc: 'Пуши и бот Telegram' },
  { id: 'stats', label: 'Статистика', icon: 'pi pi-chart-bar', desc: 'Лайки, гости, время' },
  { id: 'install', label: 'Установка', icon: 'pi pi-download', desc: 'PWA и оффлайн-кэш' },
  { id: 'telegram', label: 'Telegram', icon: 'pi pi-send', desc: 'Второй аккаунт в боте' },
  { id: 'hotkeys', label: 'Клавиши', icon: 'pi pi-keyboard', desc: 'Горячие клавиши десктопа' },
] as const

/**
 * Подтаб валиден, если есть в списке подвкладок раздела.
 *
 * @param value сырое значение из URL
 */
function isAppTabId(value: unknown): value is SettingsAppTabId {
  return typeof value === 'string' && SETTINGS_APP_TABS.some((t) => t.id === value)
}

/**
 * Активный подтаб из URL (`?apptab=stats`), null — параметр пуст/битый.
 */
function readAppTabFromUrl(): SettingsAppTabId | null {
  try {
    const raw = new URLSearchParams(window.location.search).get(SETTINGS_APP_TAB_PARAM)
    return isAppTabId(raw) ? raw : null
  } catch {
    return null
  }
}

/**
 * Страница раздела «Приложение» сейчас открыта (`/settings/app`).
 */
function isAppSettingsPage(): boolean {
  try {
    const parts = new URL(window.location.href).pathname.split('/').filter(Boolean)
    return parts[0] === 'settings' && parts[parts.length - 1] === 'app'
  } catch {
    return false
  }
}

/**
 * Записать текущий подтаб в URL без перезагрузки.
 *
 * Вызывать при входе на `/settings/app` извне хука (смена главного
 * таба): кладёт `?apptab=` из живого состояния, дефолт стирает.
 *
 * @param id подтаб для записи
 */
export function writeAppTabToUrl(id: SettingsAppTabId): void {
  try {
    if (!isAppSettingsPage()) {
      return
    }

    const url = new URL(window.location.href)

    if (id === 'sections') {
      url.searchParams.delete(SETTINGS_APP_TAB_PARAM)
    } else {
      url.searchParams.set(SETTINGS_APP_TAB_PARAM, id)
    }

    window.history.replaceState({}, '', url.toString())
  } catch {
    /* noop */
  }
}

/**
 * Общее состояние подтаба: переживает перемонтирование панели
 * (переключение главных табов не сбрасывает выбранный подтаб),
 * источником правды после перезагрузки остаётся `?apptab=` в URL.
 */
const sharedActive = ref<SettingsAppTabId>('sections')
let sharedInit = false

/**
 * Текущий подтаб раздела «Приложение» (для синхронизации из других хуков).
 */
export function getActiveAppTab(): SettingsAppTabId {
  return sharedActive.value
}

export function useSettingsAppTabs() {
  const tabs = SETTINGS_APP_TABS

  if (!sharedInit) {
    sharedActive.value = readAppTabFromUrl() ?? 'sections'
    sharedInit = true
  }

  const active = sharedActive

  /**
   * Скроллер ленты пилюль (`.p-tablist-content` внутри TabList).
   * По нему считаем затухание краёв и центрируем активную пилюлю.
   */
  const scroller = ref<HTMLElement | null>(null)
  const canLeft = ref(false)
  const canRight = ref(false)

  /**
   * Переключить подвкладку раздела «Приложение».
   *
   * Активность дублируется в `?apptab=`, чтобы перезагрузка
   * и навигация не сбрасывали выбранный подтаб.
   *
   * @param id id подвкладки из SETTINGS_APP_TABS
   */
  function setActive(id: SettingsAppTabId): void {
    active.value = id
    writeAppTabToUrl(id)
    scrollActiveIntoView()
  }

  watch(active, (id) => {
    writeAppTabToUrl(id)
  })

  /**
   * Обновить флаги затухания краёв по текущей прокрутке.
   */
  function syncEdges(): void {
    const el = scroller.value
    if (!el) {
      canLeft.value = false
      canRight.value = false
      return
    }
    const max = el.scrollWidth - el.clientWidth
    canLeft.value = el.scrollLeft > 4
    canRight.value = el.scrollLeft < max - 4
  }

  /**
   * Плавно отцентрировать активную пилюлю в ленте.
   */
  function scrollActiveIntoView(): void {
    requestAnimationFrame(() => {
      try {
        const el = scroller.value
        const current = el?.querySelector?.('.p-tab[data-p-active="true"]') as HTMLElement | null
        current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
      } catch {
        /* noop */
      }
      syncEdges()
    })
  }

  /**
   * Вертикальное колесо мыши — в горизонтальную прокрутку ленты.
   *
   * @param event событие колеса
   */
  function onWheel(event: WheelEvent): void {
    const el = scroller.value
    if (!el) return
    const dx = Math.abs(event.deltaX)
    const dy = Math.abs(event.deltaY)
    if (dy <= dx) return
    if (el.scrollWidth <= el.clientWidth + 1) return
    event.preventDefault()
    el.scrollLeft += event.deltaY
  }

  /**
   * Привязать скроллер ленты: замер краёв, колесо, ресайз.
   * Вызывать на корне TabList — контент найдётся внутри.
   *
   * @param root корневой элемент TabList (или сам скроллер)
   */
  function bindScroller(root: unknown): void {
    const maybeEl = (root as { $el?: unknown } | null)?.$el ?? root
    const rootEl = maybeEl as HTMLElement | null
    if (!rootEl || typeof rootEl.querySelector !== 'function') return
    const content = rootEl.classList?.contains('p-tablist-content')
      ? rootEl
      : rootEl.querySelector<HTMLElement>('.p-tablist-content')
    if (!content) return
    if (scroller.value === content) {
      syncEdges()
      return
    }
    scroller.value = content
    content.addEventListener('scroll', syncEdges, { passive: true })
    content.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', syncEdges)
    syncEdges()
    scrollActiveIntoView()
  }

  onBeforeUnmount(() => {
    const el = scroller.value
    el?.removeEventListener('scroll', syncEdges)
    el?.removeEventListener('wheel', onWheel)
    window.removeEventListener('resize', syncEdges)
    scroller.value = null
  })

  return { tabs, active, setActive, canLeft, canRight, bindScroller, syncEdges }
}
