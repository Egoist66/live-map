import { onBeforeUnmount, ref } from 'vue'

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
export type SettingsAppTabId = 'sections' | 'notify' | 'install' | 'telegram' | 'hotkeys'

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
  { id: 'install', label: 'Установка', icon: 'pi pi-download', desc: 'PWA и оффлайн-кэш' },
  { id: 'telegram', label: 'Telegram', icon: 'pi pi-send', desc: 'Второй аккаунт в боте' },
  { id: 'hotkeys', label: 'Клавиши', icon: 'pi pi-keyboard', desc: 'Горячие клавиши десктопа' },
] as const

export function useSettingsAppTabs() {
  const tabs = SETTINGS_APP_TABS
  const active = ref<SettingsAppTabId>('sections')

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
   * @param id id подвкладки из SETTINGS_APP_TABS
   */
  function setActive(id: SettingsAppTabId): void {
    active.value = id
    scrollActiveIntoView()
  }

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
