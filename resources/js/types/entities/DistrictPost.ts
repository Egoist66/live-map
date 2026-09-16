/**
 * Новость UDistrict: публикует владелец, читают жители и гости.
 */
export interface DistrictPostAuthor {
  id: number | null
  name: string
  avatar_url: string | null
}

/**
 * Новость района из API.
 */
export interface DistrictPost {
  id: number
  district_id: number
  title: string | null
  body: string
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
  can_edit: boolean
  can_delete: boolean
  created_at?: string | null
  updated_at?: string | null
  author: DistrictPostAuthor
  replies?: DistrictPostComment[]
  replies_count?: number
}
