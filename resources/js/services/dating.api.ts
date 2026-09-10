import { api } from './api'

/**
 * API дейтинг-ленты: свайпы, мэтчи, квоты, настройки.
 */
export interface SwipeCard {
  id: number
  name: string
  is_anonymous: boolean
  age: number | null
  age_hidden: boolean
  gender: string | null
  bio: string | null
  avatar_url: string | null
  photos: string[]
  photos_limit?: number
  is_pro?: boolean
  city: string | null
  distance_km: number | null
  goal: string | null
  custom_goal: string | null
  about: string | null
  interests: string[]
  last_seen_at: string | null
  is_match: boolean
  liked_me: boolean
}

/** Фильтры ленты знакомств. */
export interface SwipeFilters {
  goal: string | null
  gender: string
  age_min: number | null
  age_max: number | null
  radius_km: number | null
  interests: string[]
}

/** Квота рандомных чатов. */
export interface SwipeQuota {
  limit: number
  used: number
  left: number
  plan: string
  radius_limit: number | null
  can_reset: boolean
  reset_used: boolean
}

/** Анкета из таба «Активные» (онлайн). */
export interface ActiveCard extends SwipeCard {
  is_online: boolean
  can_message: boolean
  can_message_reason: string | null
}

export const datingApi = {
  async feed(filters: Partial<SwipeFilters>) {
    const params: Record<string, unknown> = {}
    if (filters.goal) params.goal = filters.goal
    if (filters.gender && filters.gender !== 'all') params.gender = filters.gender
    if (filters.age_min) params.age_min = filters.age_min
    if (filters.age_max) params.age_max = filters.age_max
    if (filters.radius_km) params.radius_km = filters.radius_km
    if (filters.interests?.length) params['interests[]'] = filters.interests
    const { data } = await api.get('/api/swipes/feed', { params })
    return data as { cards: SwipeCard[]; quota: SwipeQuota }
  },
  async act(user_id: number, action: 'like' | 'pass') {
    const { data } = await api.post('/api/swipes/action', { user_id, action })
    return data as { matched: boolean; match_id: number | null; conversation_id: number | null; quota: SwipeQuota }
  },
  async matches() {
    const { data } = await api.get('/api/swipes/matches')
    return data as { matches: Array<{ match_id: number; created_at: string; conversation_id: number | null; user: { id: number; name: string; avatar_url: string | null; last_seen_at: string | null } }>; quota: SwipeQuota }
  },
  async active() {
    const { data } = await api.get('/api/swipes/active')
    return data as { active: ActiveCard[]; quota: SwipeQuota }
  },
  async favorites() {
    const { data } = await api.get('/api/swipes/favorites')
    return data as { favorites: SwipeCard[]; limit: number }
  },
  async removeFavorite(userId: number) {
    const { data } = await api.delete(`/api/swipes/favorites/${userId}`)
    return data as { ok: boolean }
  },
  async quota() {
    const { data } = await api.get('/api/swipes/quota')
    return data as SwipeQuota
  },
  async updateSettings(patch: Record<string, unknown>) {
    const { data } = await api.patch('/api/swipes/settings', patch)
    return data
  },
  async verifyAge(birth_date: string) {
    const { data } = await api.post('/api/swipes/verify-age', { birth_date })
    return data as { ok: boolean; age: number }
  },
  /**
   * Сбросить просмотренные свайпы (только админ, для тестов).
   * @returns число удалённых записей
   */
  async resetHistory() {
    const { data } = await api.post('/api/swipes/reset-history')
    return data as { ok: boolean; deleted: number; quota?: SwipeQuota }
  },
}
