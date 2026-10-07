import { api } from './api'

/**
 * Статистика профиля по тарифу.
 */
export interface ProfileStatsLikes {
  total: number
  week: number
  month: number
}

export interface ProfileStatsViews {
  total: number
  week: number
  month: number
}

export interface ProfileStatsTime {
  today_min: number
  week_min: number
  month_min: number
  daily: Array<{ day: string; min: number }>
}

export interface ProfileStatsAudience {
  interests: Array<{ tag: string; count: number }>
  age_buckets: Record<string, number>
  gender: Record<string, number>
  total: number
}

export interface ProfileStatsVisitor {
  id: number
  name: string
  profile_slug?: string | null
  avatar_url?: string | null
  age?: number | null
  gender?: string | null
  goal?: string | null
  about?: string | null
  interests?: string[]
  viewed_at?: string | null
  can_message: boolean
  can_message_reason?: string | null
}

export interface ProfileStatsDay {
  day: string
  min: number
  likes: number
  views: number
}

export interface ProfileStatsSummary {
  plan: string
  tier: 'free' | 'pro' | 'premium'
  likes: ProfileStatsLikes
  views: ProfileStatsViews
  time: ProfileStatsTime
  matches_total: number
  unread: number
  daily: ProfileStatsDay[]
  audience: ProfileStatsAudience | null
  visitors: ProfileStatsVisitor[] | null
}

export const profileStatsApi = {
  /**
   * Сводка статистики текущего пользователя.
   *
   * @returns сводка с гейтом по тарифу
   */
  async summary(): Promise<ProfileStatsSummary> {
    const { data } = await api.get<ProfileStatsSummary>('/api/profile-stats')
    return data
  },

  /**
   * Прямая ссылка на выгрузку CSV (скачивание через браузер).
   *
   * @returns url выгрузки
   */
  exportUrl(): string {
    return '/api/profile-stats/export'
  },

  /**
   * Записать просмотр чужого профиля.
   *
   * @param userId id просматриваемого профиля
   */
  async trackView(userId: number): Promise<void> {
    await api.post(`/api/users/${userId}/view`)
  },

  /**
   * Тумблер «уведомлять о гостях профиля» (PRO и выше).
   *
   * @param notify включать ли уведомления (колокольчик + бот)
   * @returns новое состояние тумблера
   */
  async updatePreferences(notify: boolean): Promise<{ notify_profile_visitors: boolean }> {
    const { data } = await api.patch<{ notify_profile_visitors: boolean }>('/api/profile-stats/preferences', {
      notify_profile_visitors: notify,
    })
    return data
  },
}
