import { api } from '@/services/api'

export type SubscriptionStatus = {
  subscribed: boolean
  notify_pin: boolean
  notify_photo: boolean
  notify_level: boolean
  is_friend?: boolean
  can_subscribe?: boolean
}

export type SubscriptionFlags = {
  notify_pin?: boolean
  notify_photo?: boolean
  notify_level?: boolean
}

/**
 * API подписок на обновления пользователя.
 */
export const subscriptionsApi = {
  /**
   * Статус подписки на пользователя.
   * @param userId целевой пользователь
   */
  async status(userId: number | string): Promise<SubscriptionStatus> {
    const { data } = await api.get(`/api/users/${userId}/subscription`)
    return data
  },

  /**
   * Подписаться / обновить флаги.
   * @param userId целевой пользователь
   * @param flags какие уведомления слать
   */
  async subscribe(userId: number | string, flags?: SubscriptionFlags): Promise<SubscriptionStatus> {
    const { data } = await api.post(`/api/users/${userId}/subscription`, flags ?? {})
    return data
  },

  /**
   * Отписаться.
   * @param userId целевой пользователь
   */
  async unsubscribe(userId: number | string): Promise<{ subscribed: boolean }> {
    const { data } = await api.delete(`/api/users/${userId}/subscription`)
    return data
  },
}
