/**
 * Типы ленты UFlow: посты, комментарии, фильтры.
 */

/** Автор поста или комментария (аноним скрыт как id=null). */
export type FlowAuthor = {
  id: number | null
  name: string
  avatar_url: string | null
}

/** Пост ленты. */
export type FlowPost = {
  id: number
  title: string | null
  body: string
  image_url: string | null
  is_anonymous: boolean
  likes_count: number
  comments_count: number
  liked: boolean
  can_edit: boolean
  can_delete: boolean
  created_at: string | null
  updated_at: string | null
  author: FlowAuthor
}

/** Комментарий с веткой ответов. */
export type FlowComment = {
  id: number
  post_id: number
  parent_id: number | null
  content: string
  is_anonymous: boolean
  can_edit: boolean
  can_delete: boolean
  created_at: string | null
  updated_at: string | null
  author: FlowAuthor
  replies?: FlowComment[]
  replies_count?: number
}

/** Фильтр ленты. */
export type FlowFilter = 'all' | 'subscriptions' | 'mine'

/**
 * Параметры запроса ленты.
 * @param filter вкладка ленты
 * @param authorId посты конкретного пользователя (профиль)
 * @param search поиск по тексту
 * @param postId открыть один пост (диплинк из уведомлений)
 */
export type FlowQuery = {
  filter?: FlowFilter
  authorId?: number | null
  search?: string
  postId?: number | null
  page?: number
}
