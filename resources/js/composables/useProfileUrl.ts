/**
 * Каноническая ссылка на чужой профиль: `/users/{slug}` вместо `/users/{id}`.
 *
 * Id в URL светить нельзя, под капотом всё по-прежнему работает по id:
 * сервер резолвит и слаг, и числовой id (старые ссылки отвечают
 * 301 редиректом на слаг с сохранением query-строки).
 *
 * Хелпер берёт `profile_slug` из объекта пользователя, а если его нет
 * (старый кэш, обрезанный пейлоад) — подставляет id, сервер сам
 * редиректнет на канонический слаг.
 *
 * @example
 * ```ts
 * const { userProfileUrl } = useProfileUrl()
 *
 * userProfileUrl(post.author) // '/users/anna-ivanova'
 * userProfileUrl({ id: 7 }, { photo: 3 }) // '/users/7?photo=3' -> 301 -> slug
 * ```
 */

/** Минимум полей пользователя, достаточный для построения ссылки. */
export interface ProfileUrlUser {
  id?: number | string | null
  user_id?: number | string | null
  profile_slug?: string | null
}

export function useProfileUrl() {
  /**
   * Проверить, что значение — непустой идентификатор.
   *
   * @param value проверяемое значение
   * @returns true когда это непустая строка/положительное число
   */
  function isPresent(value: unknown): boolean {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0
    }

    return typeof value === 'string' && value.trim() !== ''
  }

  /**
   * Выбрать идентификатор для URL: слаг приоритетнее id.
   *
   * @param user пользователь (полный объект, актор уведомления, лайкер)
   * @returns слаг либо id строкой, либо null когда пользователя нет
   */
  function pickIdentifier(user: ProfileUrlUser | null | undefined): string | null {
    if (!user) {
      return null
    }

    const slug = typeof user.profile_slug === 'string' ? user.profile_slug.trim() : ''

    if (slug !== '') {
      return slug
    }

    const rawId = user.id ?? user.user_id ?? null

    if (!isPresent(rawId)) {
      return null
    }

    return String(rawId)
  }

  /**
   * Построить ссылку на профиль: `/users/{slug|id}[?query]`.
   *
   * @param user пользователь или объект с id/profile_slug
   * @param query дополнительные query-параметры (`photo`, `comment`)
   * @returns относительный URL профиля либо '#' когда пользователя нет
   */
  function userProfileUrl(user: ProfileUrlUser | null | undefined, query?: Record<string, string | number | null | undefined>): string {
    const identifier = pickIdentifier(user)

    if (!identifier) {
      return '#'
    }

    const base = `/users/${identifier}`

    if (!query) {
      return base
    }

    const params = new URLSearchParams()

    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return
      }

      params.set(key, String(value))
    })

    const suffix = params.toString()

    return suffix === '' ? base : `${base}?${suffix}`
  }

  return { userProfileUrl }
}
