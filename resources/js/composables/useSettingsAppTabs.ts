import { ref } from 'vue'

/**
 * Смысловые подтабы раздела «Приложение» в настройках.
 *
 * Раздел разросся в простыню (модули, пуши, установка, Telegram,
 * избранное, хоткеи) — каждая смысловая группа живёт на своей
 * подвкладке, компонент `SettingsAppTab` только рисует табы.
 *
 * @returns список подтабов, активный id и переключатель
 * @example
 * const { tabs, active, setActive } = useSettingsAppTabs()
 */
export type SettingsAppTabId = 'sections' | 'notify' | 'install' | 'telegram' | 'notes' | 'hotkeys'

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
  { id: 'notes', label: 'Избранное', icon: 'pi pi-star', desc: 'Где хранятся заметки' },
  { id: 'hotkeys', label: 'Клавиши', icon: 'pi pi-keyboard', desc: 'Горячие клавиши десктопа' },
] as const

export function useSettingsAppTabs() {
  const tabs = SETTINGS_APP_TABS
  const active = ref<SettingsAppTabId>('sections')

  /**
   * Переключить подвкладку раздела «Приложение».
   *
   * @param id id подвкладки из SETTINGS_APP_TABS
   */
  function setActive(id: SettingsAppTabId): void {
    active.value = id
  }

  return { tabs, active, setActive }
}
