import { ref, computed, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useSecurityImpersonations } from '@/composables/useSecurityImpersonations'
import { useAppModulesStore } from '@/stores/appModules'

export type SettingsTabId = 'profile'|'billing'|'quests'|'privacy'|'appearance'|'security'|'pins'|'support'|'app'|'integrations'|'about'|'procedures'|'admin'|'archive'

export const SETTINGS_TABS = [
  { id: 'profile' as const, label: 'Профиль', icon: 'pi pi-user', desc: 'Фото, имя, дом' },
  { id: 'billing' as const, label: 'Тариф', icon: 'pi pi-star', desc: 'План, лимиты' },
  { id: 'quests' as const, label: 'Задания', icon: 'pi pi-trophy', desc: 'PRO на неделю' },
  { id: 'pins' as const, label: 'Мои пины', icon: 'pi pi-map-marker', desc: 'Созданные, удалить' },
  { id: 'archive' as const, label: 'Архив', icon: 'pi pi-folder', desc: 'Файлы, 15 дней' },
  { id: 'privacy' as const, label: 'Приватность', icon: 'pi pi-lock', desc: 'Анонимность, зона' },
  { id: 'appearance' as const, label: 'Внешний вид', icon: 'pi pi-palette', desc: 'Тема, карта' },
  { id: 'security' as const, label: 'Безопасность', icon: 'pi pi-shield', desc: 'Пароль, удаление' },
  { id: 'procedures' as const, label: 'Процедуры', icon: 'pi pi-building-columns', desc: 'Доступы, закон' },
  { id: 'support' as const, label: 'Поддержка', icon: 'pi pi-heart', desc: 'Письмо, донат' },
  { id: 'app' as const, label: 'Приложение', icon: 'pi pi-mobile', desc: 'Установка, кэш' },
  { id: 'integrations' as const, label: 'Интеграции', icon: 'pi pi-share-alt', desc: 'Бот, QR' },
  { id: 'about' as const, label: 'О сервисе', icon: 'pi pi-info-circle', desc: 'FAQ, контакты, документы' },
] as const

export const SETTINGS_TAB_INDEX: Record<SettingsTabId, string> = {
  profile: '0', billing: '1', quests: '2', pins: '3', archive: '4', privacy: '5', appearance: '6', security: '7', procedures: '8', support: '9', app: '10', integrations: '11', about: '12', admin: '13',
}

export const ADMIN_TAB = { id: 'admin' as const, label: 'Модерация', icon: 'pi pi-shield', desc: 'Скрытие, удаление' } as const

export function useSettingsTabs() {
  const page = usePage()
  const isAdmin = computed(() => !!((page.props.auth as any)?.user?.is_admin) || (page.props.auth as any)?.user?.role === 'admin')
  const modules = useAppModulesStore()

  try {
    modules.ensureInit((page.props as any)?.auth?.user ?? null)
  } catch {
  }

  /**
   * Таб виден при включённом модуле: пины — только с картой,
   * задания — со свайпами или картой, остальное — системное.
   */
  const isTabVisible = (id: string): boolean => {
    if (id === 'pins') {
      return modules.isEnabled('upin')
    }

    if (id === 'quests') {
      return modules.isEnabled('ulove') || modules.isEnabled('upin')
    }

    return true
  }

  const active = ref<SettingsTabId>('profile')
  try {
    const all = [...SETTINGS_TABS, ADMIN_TAB]
    const valid = (t: unknown): t is SettingsTabId =>
      typeof t === 'string' && (all as any[]).some((x) => x.id === t) && (t !== 'admin' || isAdmin.value) && isTabVisible(t)
    const fromRoute = (page.props as any)?.initialTab
    const fromQuery = new URLSearchParams(window.location.search).get('tab')
    if (valid(fromRoute)) active.value = fromRoute
    else if (valid(fromQuery)) active.value = fromQuery
  } catch {}
  const proc = useSecurityImpersonations()
  const showProcedures = computed(() => proc.items.value.length > 0 || proc.unread.value > 0 || active.value === 'procedures')
  const tabs = computed(() => {
    const base = SETTINGS_TABS.filter((t) => (t.id !== 'procedures' || showProcedures.value) && isTabVisible(t.id))
    return isAdmin.value ? [...base, ADMIN_TAB] : [...base]
  })

  watch(tabs, (visible) => {
    const ids = new Set(visible.map((t) => t.id))

    if (!ids.has(active.value)) {
      active.value = 'profile'
    }
  })
  const tabIndex = SETTINGS_TAB_INDEX
  const activeIndex = computed(() => tabIndex[active.value])
  const setActive = (id: SettingsTabId) => { active.value = id }

  watch(active, (id) => {
    try {
      const url = new URL(window.location.href)
      if (!url.pathname.startsWith('/settings')) return
      const ids = new Set([...SETTINGS_TABS, ADMIN_TAB].map((t) => t.id))
      const rest = url.pathname.split('/').filter(Boolean).slice(1)
      if (rest.length === 1 && rest[0] === 'admin' && id === 'admin') return
      if (rest.length && ids.has(rest[rest.length - 1] as any) && !(rest.length === 1 && rest[0] === 'admin')) rest.pop()
      rest.push(id)
      url.pathname = '/settings' + (rest.length ? `/${rest.join('/')}` : '')
      url.searchParams.delete('tab')
      window.history.replaceState({}, '', url.toString())
    } catch {}
  })

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

  return { active, tabs, tabIndex, activeIndex, menuModel, setActive, isAdmin, showProcedures }
}
