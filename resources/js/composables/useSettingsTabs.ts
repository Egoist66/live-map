import { ref, computed } from 'vue'

export type SettingsTabId = 'profile'|'billing'|'privacy'|'appearance'|'security'|'pins'|'support'

export const SETTINGS_TABS = [
  { id: 'profile' as const, label: 'Профиль', icon: 'pi pi-user', desc: 'Фото, имя, дом' },
  { id: 'billing' as const, label: 'Тариф', icon: 'pi pi-star', desc: 'План, лимиты' },
  { id: 'pins' as const, label: 'Мои пины', icon: 'pi pi-map-marker', desc: 'Созданные, удалить' },
  { id: 'privacy' as const, label: 'Приватность', icon: 'pi pi-lock', desc: 'Анонимность, зона' },
  { id: 'appearance' as const, label: 'Внешний вид', icon: 'pi pi-palette', desc: 'Тема, карта' },
  { id: 'security' as const, label: 'Безопасность', icon: 'pi pi-shield', desc: 'Пароль, удаление' },
  { id: 'support' as const, label: 'Поддержка', icon: 'pi pi-heart', desc: 'Письмо, донат' },
] as const

export const SETTINGS_TAB_INDEX: Record<SettingsTabId, string> = {
  profile: '0', billing: '1', pins: '2', privacy: '3', appearance: '4', security: '5', support: '6',
}

export function useSettingsTabs() {
  const active = ref<SettingsTabId>('profile')
  const tabs = SETTINGS_TABS
  const tabIndex = SETTINGS_TAB_INDEX
  const activeIndex = computed(() => tabIndex[active.value])
  const setActive = (id: SettingsTabId) => { active.value = id }

  const menuModel = computed(() =>
    tabs.map((t) => ({
      label: t.label,
      icon: t.icon,
      desc: t.desc,
      id: t.id,
      active: active.value === t.id,
      command: () => { active.value = t.id },
    }))
  )

  return { active, tabs, tabIndex, activeIndex, menuModel, setActive }
}
