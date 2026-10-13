import { api } from './api'

/** Состояние подписки: срок, остаток дней, нужно ли окно продления. */
export interface SubscriptionStatus {
  plan: string
  expires_at: string | null
  days_left: number | null
  expired: boolean
  needs_renewal: boolean
}

/** Возможность тарифа («что входит») — список ведётся в админке. */
export interface PlanCatalogFeature {
  key: string
  name: string
  description: string | null
}

/** Карточка тарифа из каталога: всё динамическое с бэкенда. */
export interface PlanCatalogCard {
  id: string
  name: string
  price: string
  tagline: string
  prices: Record<'monthly' | 'regional_monthly' | 'yearly' | 'weekly', number | null>
  features: PlanCatalogFeature[]
}

/** Позиция витрины из каталога (кредиты, фишки, реклама). */
export interface PlanCatalogItem {
  key: string
  module: string
  kind: string
  name: string
  description: string | null
  price: number | null
  price_label: string
  prices_by_plan: Record<string, number | null>
  price_for_plan: number | null
  currency: string
  period: string | null
  payload: Record<string, unknown>
}

/** Публичный каталог тарифов своей аудитории. */
export interface PlansCatalog {
  plans: PlanCatalogCard[]
  items: PlanCatalogItem[]
  period_days: number
}

export const subscriptionApi = {
  async status(): Promise<SubscriptionStatus> {
    const { data } = await api.get('/api/subscription/status')
    return data as SubscriptionStatus
  },
  async plans(): Promise<PlansCatalog> {
    const { data } = await api.get('/api/subscription/plans')
    return data as PlansCatalog
  },
  async renew(plan: 'pro' | 'premium' | 'business'): Promise<SubscriptionStatus> {
    const { data } = await api.post('/api/subscription/renew', { plan })
    return data as SubscriptionStatus
  },
  async cancel(): Promise<SubscriptionStatus> {
    const { data } = await api.post('/api/subscription/cancel')
    return data as SubscriptionStatus
  },
}
