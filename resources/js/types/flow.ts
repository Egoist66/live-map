/**
 * Типы ленты UFlow: посты, комментарии, фильтры.
 */

/** Автор поста или комментария (аноним скрыт как id=null). */
export type FlowAuthor = {
  id: number | null
  name: string
  avatar_url: string | null
}

/** Встроенный оригинал репоста (автор скрыт при анонимности). */
export type FlowRepostOrigin = {
  id: number
  title: string | null
  body: string
  image_url: string | null
  author: FlowAuthor
}

/** Медиа поста: фото или видео. */
export type FlowMedia = {
  id: number
  kind: 'photo' | 'video'
  url: string | null
  duration_sec: number | null
}

/** Вариант опроса. */
export type FlowPollOption = {
  id: number
  text: string
  votes_count: number
}

/** Опрос поста. */
export type FlowPoll = {
  id: number
  closed: boolean
  closes_at: string | null
  total_votes: number
  voted_option_id: number | null
  options: FlowPollOption[]
}

/** Компания-автор новости (пост от бренда). */
export type FlowCompany = {
  id: number
  name: string
  brand: string | null
  logo_url: string | null
  is_verified: boolean
  owner_profile: string | null
}

/** Пост ленты. */
export type FlowPost = {
  id: number
  title: string | null
  body: string
  company: FlowCompany | null
  image_url: string | null
  media: FlowMedia[]
  poll: FlowPoll | null
  tags: string[]
  is_anonymous: boolean
  likes_count: number
  comments_count: number
  repost_of_id: number | null
  repost_comment: string | null
  reposts_count: number
  my_repost_id: number | null
  repost: FlowRepostOrigin | null
  liked: boolean
  can_edit: boolean
  can_delete: boolean
  can_comment: boolean
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

/** Сортировка ветки комментариев. */
export type FlowCommentsSort = 'new' | 'top'

/** Тег из трендов. */
export type FlowTag = {
  id: number
  name: string
  posts_count: number
}

/** Фильтр ленты. */
export type FlowFilter = 'all' | 'subscriptions' | 'mine'

/**
 * Параметры запроса ленты.
 * @param filter вкладка ленты
 * @param authorId посты конкретного пользователя (профиль)
 * @param search поиск по тексту
 * @param tag фильтр по хэштегу
 * @param postId открыть один пост (диплинк из уведомлений)
 */
export type FlowQuery = {
  filter?: FlowFilter
  authorId?: number | null
  search?: string
  tag?: string | null
  postId?: number | null
  page?: number
}
