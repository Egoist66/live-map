import { api } from './api'

/** Состояние подписки: срок, остаток дней, нужно ли окно продления. */
export interface SubscriptionStatus {
  plan: string
  expires_at: string | null
  days_left: number | null
  expired: boolean
  needs_renewal: boolean
}

export const subscriptionApi = {
  async status(): Promise<SubscriptionStatus> {
    const { data } = await api.get('/api/subscription/status')
    return data as SubscriptionStatus
  },
  async renew(plan: 'pro' | 'business'): Promise<SubscriptionStatus> {
    const { data } = await api.post('/api/subscription/renew', { plan })
    return data as SubscriptionStatus
  },
  async cancel(): Promise<SubscriptionStatus> {
    const { data } = await api.post('/api/subscription/cancel')
    return data as SubscriptionStatus
  },
}
