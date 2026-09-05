import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

export type SettingsTabId = 'profile'|'billing'|'privacy'|'appearance'|'security'|'pins'|'support'|'app'|'admin'

export const SETTINGS_TABS = [
  { id: 'profile' as const, label: 'Профиль', icon: 'pi pi-user', desc: 'Фото, имя, дом' },
  { id: 'billing' as const, label: 'Тариф', icon: 'pi pi-star', desc: 'План, лимиты' },
  { id: 'pins' as const, label: 'Мои пины', icon: 'pi pi-map-marker', desc: 'Созданные, удалить' },
  { id: 'privacy' as const, label: 'Приватность', icon: 'pi pi-lock', desc: 'Анонимность, зона' },
  { id: 'appearance' as const, label: 'Внешний вид', icon: 'pi pi-palette', desc: 'Тема, карта' },
  { id: 'security' as const, label: 'Безопасность', icon: 'pi pi-shield', desc: 'Пароль, удаление' },
  { id: 'support' as const, label: 'Поддержка', icon: 'pi pi-heart', desc: 'Письмо, донат' },
  { id: 'app' as const, label: 'Приложение', icon: 'pi pi-mobile', desc: 'Установка, кэш' },
] as const

export const SETTINGS_TAB_INDEX: Record<SettingsTabId, string> = {
  profile: '0', billing: '1', pins: '2', privacy: '3', appearance: '4', security: '5', support: '6', app: '7', admin: '8',
}

export const ADMIN_TAB = { id: 'admin' as const, label: 'Админ', icon: 'pi pi-shield', desc: 'Скрытие, удаление' } as const

export function useSettingsTabs() {
  const page = usePage()
  const isAdmin = computed(() => !!((page.props.auth as any)?.user?.is_admin) || (page.props.auth as any)?.user?.role === 'admin')
  const active = ref<SettingsTabId>('profile')
  try {
    const t = new URLSearchParams(window.location.search).get('tab') as SettingsTabId | null
    const all = [...SETTINGS_TABS, ADMIN_TAB]
    if (t && all.some((x) => x.id === t) && (t !== 'admin' || isAdmin.value)) active.value = t
  } catch {}
  const tabs = computed(() => (isAdmin.value ? [...SETTINGS_TABS, ADMIN_TAB] : [...SETTINGS_TABS]))
  const tabIndex = SETTINGS_TAB_INDEX
  const activeIndex = computed(() => tabIndex[active.value])
  const setActive = (id: SettingsTabId) => { active.value = id }

  const menuModel = computed(() =>
    tabs.value.map((t) => ({
      label: t.label,
      icon: t.icon,
      desc: t.desc,
      id: t.id,
      active: active.value === t.id,
      command: () => { active.value = t.id },
    }))
  )

  return { active, tabs, tabIndex, activeIndex, menuModel, setActive, isAdmin }
}
