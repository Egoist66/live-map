/**
 * Новость UDistrict: публикует владелец, читают жители и гости.
 */
export interface DistrictPostAuthor {
  id: number | null
  name: string
  avatar_url: string | null
}

/**
 * Флаги модерации публичного контента (бэкенд ContentModeration::flagsFor).
 */
export interface ModerationFlags {
  is_toxic: boolean
  category: string | null
  label: string | null
  blur: boolean
}

/**
 * Новость района из API.
 */
export interface DistrictPost {
  id: number
  district_id: number
  title: string | null
  body: string
  moderation?: ModerationFlags | null
  company: import('@/types/flow').FlowCompany | null
  image_url: string | null
  likes_count: number
  comments_count: number
  liked: boolean
  can_edit: boolean
  can_delete: boolean
  created_at?: string | null
  updated_at?: string | null
  author: DistrictPostAuthor
}

/**
 * Комментарий новости района с ветками.
 */
export interface DistrictPostComment {
  id: number
  post_id: number
  parent_id: number | null
  content: string
  moderation?: ModerationFlags | null
  can_edit: boolean
  can_delete: boolean
  created_at?: string | null
  updated_at?: string | null
  author: DistrictPostAuthor
  replies?: DistrictPostComment[]
  replies_count?: number
}
