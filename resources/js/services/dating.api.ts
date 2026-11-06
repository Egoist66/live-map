import { api } from './api'

/**
 * API дейтинг-ленты: свайпы, мэтчи, квоты, настройки.
 */
export interface SwipeCard {
  /** id кандидата; null у «Тайного поклонника» (инкогнито скрывает и id). */
  id: number | null
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
  /** Район без улицы; null — скрыт приватностью или не задан. */
  district?: string | null
  /** Страна из анкеты — резервная подпись, если город не указан. */
  country?: string | null
  distance_km: number | null
  distance_hidden: boolean
  goal: string | null
  custom_goal: string | null
  about: string | null
  interests: string[]
  last_seen_at: string | null
  is_match: boolean
  liked_me: boolean
  /** Лайкнул меня суперлайком — подсветить синей звездой. */
  is_superlike?: boolean
  /** У кандидата активен буст — летит первым в лентах. */
  is_boosted?: boolean
  /** Средний рейтинг отзывов; null — нет отзывов или рейтинг скрыт. */
  rating_avg?: number | null
  /** Число отзывов (0 у скрытого и без отзывов). */
  rating_count?: number
  /** Рейтинг скрыт владельцем (PRO+) — звёзды не показываем. */
  rating_hidden?: boolean
  /** Репутация 1–10; null у «Тайного поклонника». */
  trust_score?: number | null
  /**
   * Подтверждён ли email кандидата (email_verified_at на бэке).
   * false — показать метку «Аккаунт не верифицирован» на карточке.
   */
  email_verified?: boolean
  /** Флаги модерации анкеты (бэкенд ContentModeration::flagsFor). */
  moderation?: import('@/types/flow').ModerationFlags | null
}

/** Статус модерации отзыва: до одобрения он нигде не виден. */
export type DatingReviewStatus = 'pending' | 'approved' | 'rejected'

/** Один отзыв о пользователе знакомств. */
export interface DatingReviewItem {
  id: number
  /** кто оценил (в realtime-пейлоаде — для фильтра по автору) */
  author_id?: number
  /** кого оценили */
  target_id?: number
  rating: number
  body: string | null
  /** pending — отзыв ждёт решения модератора в админке */
  status?: DatingReviewStatus
  moderation?: import('@/types/flow').ModerationFlags | null
  created_at: string | null
  author: { id: number; name: string; avatar_url: string | null; profile_slug: string | null } | null
}

/** Сводка рейтинга: среднее, число, скрыт ли. */
export interface DatingRatingSummary {
  avg: number | null
  count: number
  hidden: boolean
}

/** Кто меня оценил: сводка, раскладка по звёздам, список авторов. */
export interface MyRatersResponse {
  /** true — нет Premium: список пуст, имена скрыты */
  locked: boolean
  summary: DatingRatingSummary
  /** число отзывов по звёздам 1–5 (обезличено, видно всем) */
  distribution: Record<number, number>
  raters: DatingReviewItem[]
  meta: { current_page: number; last_page: number; has_more: boolean; total: number }
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

/** Квота рандомных чатов. План и лимиты — по действующему тарифу. */
export interface SwipeQuota {
  limit: number
  used: number
  left: number
  plan: string
  plan_expires_at: string | null
  radius_limit: number | null
  can_reset: boolean
  reset_used: boolean
  /** Разовые экстра-товары: суперлайки, буст, откаты. -1 в остатках — безлимит. */
  extras?: SwipeExtras
}

/** Состояние экстра-товаров ULove из quotaState бэка. */
export interface SwipeExtras {
  superlikes_left: number
  superlikes_daily: number
  superlike_balance: number
  boosts_balance: number
  boost_active: boolean
  boost_until: string | null
  undos_left: number
  can_undo: boolean
}

/** Анкета из таба «Активные» (онлайн). */
export interface ActiveCard extends SwipeCard {
  is_online: boolean
  can_message: boolean
  can_message_reason: string | null
}

/** Локация зрителя свайпов: страна, город, район/улица без номера дома. */
export interface SwipeLocation {
  lat: number
  lng: number
  city: string | null
  address: string | null
  country: string | null
  country_code: string | null
}

/** Пагинированный ответ списков свайпов. */
export interface SwipePage<T> {
  current_page: number
  last_page: number
  total: number
  has_more: boolean
  quota?: SwipeQuota
}

export const datingApi = {
  async feed(filters: Partial<SwipeFilters>, excludeIds: number[] = [], limit = 20) {
    const params: Record<string, unknown> = {}
    if (filters.goal) params.goal = filters.goal
    // Пол шлём всегда: явное «Все» в UI должно побеждать сохранённый dating_gender_pref.
    params.gender = filters.gender || 'all'
    if (filters.age_min) params.age_min = filters.age_min
    if (filters.age_max) params.age_max = filters.age_max
    if (filters.radius_km) params.radius_km = filters.radius_km
    if (filters.interests?.length) params['interests[]'] = filters.interests
    if (excludeIds.length) params['exclude_ids[]'] = excludeIds
    params.limit = limit
    const { data } = await api.get('/api/swipes/feed', { params })
    return data as { cards: SwipeCard[]; quota: SwipeQuota }
  },
  async act(user_id: number, action: 'like' | 'pass', incognito = false, superlike = false) {
    const { data } = await api.post('/api/swipes/action', { user_id, action, incognito, superlike })
    return data as { matched: boolean; match_id: number | null; conversation_id: number | null; is_incognito?: boolean; is_superlike?: boolean; quota: SwipeQuota }
  },
  async matches(page = 1, perPage = 20) {
    const { data } = await api.get('/api/swipes/matches', { params: { page, per_page: perPage } })
    return data as { matches: Array<{ match_id: number; created_at: string; conversation_id: number | null; user: { id: number; name: string; avatar_url: string | null; last_seen_at: string | null } }>; quota: SwipeQuota } & SwipePage<unknown>
  },
  async active(page = 1, perPage = 20) {
    const { data } = await api.get('/api/swipes/active', { params: { page, per_page: perPage } })
    return data as { active: ActiveCard[]; quota: SwipeQuota } & SwipePage<unknown>
  },
  async favorites(page = 1, perPage = 20) {
    const { data } = await api.get('/api/swipes/favorites', { params: { page, per_page: perPage } })
    return data as { favorites: SwipeCard[]; limit: number } & SwipePage<unknown>
  },
  async admirers(page = 1, perPage = 20) {
    const { data } = await api.get('/api/swipes/admirers', { params: { page, per_page: perPage } })
    return data as { admirers: Array<SwipeCard & { is_incognito?: boolean; created_at?: string }>; total: number; incognito_count: number } & SwipePage<unknown>
  },
  async removeFavorite(userId: number) {
    const { data } = await api.delete(`/api/swipes/favorites/${userId}`)
    return data as { ok: boolean }
  },
  async quota() {
    const { data } = await api.get('/api/swipes/quota')
    return data as SwipeQuota
  },
  /**
   * Сохранить локацию профиля для «Людей рядом» и дистанций в свайпах.
   *
   * @param payload координаты и части адреса без номера дома
   * @returns сохранённая локация профиля
   */
  async updateLocation(payload: {
    lat: number
    lng: number
    city: string | null
    address: string | null
    country: string | null
    country_code: string | null
  }) {
    const { data } = await api.post('/api/user/location', payload)
    return data as SwipeLocation
  },
  async updateSettings(patch: Record<string, unknown>) {
    const { data } = await api.patch('/api/swipes/settings', patch)
    return data
  },
  /**
   * Импортировать анкету из JSON-файла, скачанного ранее.
   *
   * @param file JSON-файл анкеты ULove
   * @returns сохранённые поля анкеты
   */
  async importSettings(file: File) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post('/api/swipes/settings/import', form)
    return data as Record<string, unknown>
  },
  async verifyAge(birth_date: string) {
    const { data } = await api.post('/api/swipes/verify-age', { birth_date })
    return data as { ok: boolean; age: number }
  },
  /**
   * Откатить последний свайп: вернуть анкету в начало колоды.
   * @param userId ожидаемый id (сверка «последний ли»), null — просто последний
   * @returns откаченное действие и rebuilt-карточка
   */
  async undo(userId?: number | null) {
    const { data } = await api.post('/api/swipes/undo', userId != null ? { user_id: userId } : {})
    return data as { user_id: number; action: string; card: SwipeCard; quota: SwipeQuota }
  },
  /**
   * Включить буст профиля на 30 минут.
   * @returns конец буста и свежая квота
   */
  async boost() {
    const { data } = await api.post('/api/swipes/boost')
    return data as { boost_until: string; quota: SwipeQuota }
  },
  /**
   * Купить разовый товар (стаб оплаты: начисляет сразу).
   * @param item superlike_pack (+5) или boost (+1)
   * @returns начисленное и свежее состояние экстра
   */
  async purchaseExtras(item: 'superlike_pack' | 'boost') {
    const { data } = await api.post('/api/swipes/extras/purchase', { item })
    return data as { item: string; granted: number; extras: SwipeExtras; quota: SwipeQuota }
  },
  /**
   * Сбросить просмотренные свайпы. Free — один раз, PRO — безлимит.
   * @returns число удалённых записей
   */
  async resetHistory() {
    const { data } = await api.post('/api/swipes/reset-history')
    return data as { ok: boolean; deleted: number; quota?: SwipeQuota }
  },
  /**
   * Отзывы о человеке: сводка, право оценить, мой отзыв и список.
   * @param userId о ком отзывы
   * @param page страница списка
   */
  async reviews(userId: number, page = 1) {
    const { data } = await api.get('/api/dating/reviews', { params: { user_id: userId, page } })
    return data as {
      summary: DatingRatingSummary
      can_review: boolean
      /** Почему нельзя оценить (hint для UI) или null. */
      can_review_reason?: string | null
      my_review: DatingReviewItem | null
      reviews: DatingReviewItem[]
      meta: { current_page: number; last_page: number; has_more: boolean; total: number }
    }
  },
  /**
   * Оставить отзыв или поправить текст своего (1–5 звёзд, текст до 280).
   * Звёзды ставятся один раз: при правке текста слать rating не нужно.
   * @param userId о ком отзыв
   * @param rating звёзды или null (только текст)
   * @param body текст или null
   */
  async saveReview(userId: number, rating: number | null, body: string | null) {
    const { data } = await api.post('/api/dating/reviews', { user_id: userId, rating, body })
    return data as { review: DatingReviewItem; summary: DatingRatingSummary }
  },
  /**
   * Удалить свой отзыв.
   * @param userId о ком был отзыв
   */
  async deleteReview(userId: number) {
    const { data } = await api.delete('/api/dating/reviews', { params: { user_id: userId } })
    return data as { ok: boolean; deleted: boolean }
  },
  /**
   * Удалить чужой отзыв: только персонал (админ/модератор) и всегда
   * с обязательным объяснением — оно уходит автору уведомлением и
   * письмом на почту.
   * @param reviewId id удаляемого отзыва
   * @param reason объяснение от модератора (5–500 символов)
   */
  async deleteReviewById(reviewId: number, reason: string) {
    const { data } = await api.delete(`/api/dating/reviews/${reviewId}`, { data: { reason } })
    return data as { ok: boolean }
  },
  /**
   * Кто меня оценил: сводка, раскладка по звёздам и авторы отзывов.
   * Без Premium — locked:true и пустой список (имена скрыты).
   * @param page страница списка
   */
  async myRaters(page = 1) {
    const { data } = await api.get('/api/dating/my-raters', { params: { page } })
    return data as MyRatersResponse
  },
}
