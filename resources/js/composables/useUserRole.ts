export type UserRoleTag = {
  label: string
  severity: 'danger' | 'warn'
}

type RoleUser = {
  is_admin?: boolean | null
  role?: string | null
}

/**
 * Хук лейбла роли пользователя (админ ≠ модератор).
 *
 * Админ (`is_admin` или `role === 'admin'`) — это «бог», ему показываем
 * `АДМИН`. Тег `МОДЕРАТОР` — только чистым модераторам
 * (`role === 'moderator'` без админки). Обычным юзерам — никакого тега.
 *
 * @returns методы roleTag/isAdmin/isModerator для шаблонов списков и профилей.
 * @example
 * const { roleTag } = useUserRole()
 * const tag = roleTag(u) // { label: 'АДМИН', severity: 'danger' } | null
 */
export function useUserRole() {
  /**
   * Юзер — администратор (флаг is_admin или role admin).
   *
   * @param user строка пользователя (онлайн-список, профиль, мониторинг)
   * @returns true если админ
   */
  function isAdmin(user: RoleUser | null | undefined): boolean {
    if (!user) return false
    return !!user.is_admin || user.role === 'admin'
  }

  /**
   * Юзер — только модератор (role moderator, но не админ).
   *
   * @param user строка пользователя
   * @returns true если чистый модератор
   */
  function isModerator(user: RoleUser | null | undefined): boolean {
    if (!user || isAdmin(user)) return false
    return user.role === 'moderator'
  }

  /**
   * Тег роли для отображения рядом с именем.
   *
   * @param user строка пользователя
   * @returns тег { label, severity } или null для обычных юзеров
   */
  function roleTag(user: RoleUser | null | undefined): UserRoleTag | null {
    if (isAdmin(user)) return { label: 'АДМИН', severity: 'danger' }
    if (isModerator(user)) return { label: 'МОДЕРАТОР', severity: 'warn' }
    return null
  }

  /**
   * Приложить тег роли к каждому юзеру списка (для v-for без вызовов в шаблоне).
   *
   * @param list сырой список пользователей
   * @returns тот же список с полем tag
   */
  function withRoleTags<T extends RoleUser>(list: T[]): (T & { tag: UserRoleTag | null })[] {
    return (list ?? []).map((user) => ({ ...user, tag: roleTag(user) }))
  }

  return { isAdmin, isModerator, roleTag, withRoleTags }
}
