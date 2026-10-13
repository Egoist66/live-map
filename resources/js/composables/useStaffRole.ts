import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import type { AdminTabId } from '@/composables/useAdminTabs'

/**
 * Табы панели, доступные модератору без полных прав.
 *
 * Управление и Безопасность — только для админов.
 */
export const MODERATOR_TABS: readonly AdminTabId[] = ['stats', 'admin', 'business', 'refs', 'seo', 'telegram']

/**
 * Минимальная форма пользователя для проверки «свой/чужой админ».
 */
export interface StaffTarget {
  is_admin?: boolean | null
  role?: string | null
}

/**
 * Роли staff-пользователей панели модерации.
 *
 * Любой админ — это и модератор (может всё), а модератор —
 * не админ: видит только Статистику, Модерацию, Бизнес, Справочники,
 * SEO и Telegram, а по отношению к админам не может вообще ничего
 * (ни скрыть, ни удалить — бэкенд тоже запрещает).
 *
 * @returns Флаги ролей, список доступных табов и проверки целей.
 * @example
 * const staff = useStaffRole()
 * if (!staff.isAdmin.value) setTab('stats')
 */
export function useStaffRole() {
  const staffUser = computed(() => (usePage().props.auth as any)?.user ?? null)

  const isAdmin = computed(() => {
    const user = staffUser.value
    return !!user?.is_admin || user?.role === 'admin'
  })

  const isModerator = computed(() => {
    const user = staffUser.value
    return isAdmin.value || user?.role === 'moderator'
  })

  const allowedTabs = computed<readonly AdminTabId[]>(() => {
    if (isAdmin.value) {
      return ['stats', 'manage', 'security', 'admin', 'business', 'modules', 'ai', 'refs', 'seo', 'telegram', 'payments']
    }

    return MODERATOR_TABS
  })

  /**
   * Это админ-аккаунт (цель, которую модератору трогать нельзя)?
   *
   * @param target Строка пользователя из списка.
   * @returns True если цель — администратор.
   */
  function isAdminAccount(target: StaffTarget | null | undefined): boolean {
    if (!target) {
      return false
    }

    return !!target.is_admin || target.role === 'admin'
  }

  /**
   * Может ли текущий staff трогать цель (скрыть/удалить/забанить)?
   *
   * Админ может всё. Модератор — только не-админов.
   *
   * @param target Строка пользователя из списка.
   * @returns True если действие разрешено показать.
   */
  function canManageUser(target: StaffTarget | null | undefined): boolean {
    if (!target) {
      return false
    }

    if (isAdminAccount(target)) {
      return isAdmin.value
    }

    return isModerator.value
  }

  /**
   * Доступен ли таб текущему staff?
   *
   * @param tab ID таба админ-панели.
   * @returns True если таб можно показать.
   */
  function canViewTab(tab: AdminTabId): boolean {
    return allowedTabs.value.includes(tab)
  }

  return {
    staffUser,
    isAdmin,
    isModerator,
    allowedTabs,
    isAdminAccount,
    canManageUser,
    canViewTab,
  }
}
