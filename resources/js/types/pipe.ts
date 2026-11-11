/**
 * Типы мини-приложения Pipe (pipe.ulove.by): треды, ответы, подписки.
 */

/** Автор треда или ответа (аноним скрыт: id=null, name=«Аноним»). */
export type PipeAuthor = {
  id: number | null
  name: string
  profile_slug?: string | null
  avatar_url: string | null
}

/** Флаги локальной модерации (ContentModeration::flagsFor). */
export type PipeModerationFlags = {
  is_toxic: boolean
  category: string | null
  label: string | null
  blur: boolean
}

/** Картинка треда (до 3): оптимизированный оригинал + миниатюра. */
export type PipeThreadImage = {
  id: number
  url: string
  thumb_url?: string | null
}

/** Тред ленты Pipe. */
export type PipeThread = {
  id: number
  body: string
  is_anonymous: boolean
  moderation?: PipeModerationFlags | null
  moderation_category: string | null
  likes_count: number
  replies_count: number
  liked: boolean
  saved: boolean
  images: PipeThreadImage[]
  can_edit: boolean
  can_delete: boolean
  created_at: string | null
  author: PipeAuthor
}

/** Минимальный payload родительского ответа: цитата-контекст ветки. */
export type PipeReplyParent = {
  id: number
  body: string
  author: PipeAuthor
}

/** Ответ на тред (или на другой ответ через parent_id). */
export type PipeReply = {
  id: number
  thread_id: number
  parent_id: number | null
  body: string
  is_anonymous: boolean
  is_pinned?: boolean
  pinned_at?: string | null
  moderation?: PipeModerationFlags | null
  moderation_category: string | null
  likes_count: number
  liked: boolean
  can_edit: boolean
  can_delete: boolean
  can_pin?: boolean
  created_at: string | null
  updated_at?: string | null
  author: PipeAuthor
  parent?: PipeReplyParent | null
  replies_count: number
  replies: PipeReply[]
}

/**
 * Вкладки ленты: все / мои треды / избранные закладки.
 * 'following' остаётся валидным значением бэка (API-совместимость),
 * но в UI подписки больше нет.
 */
export type PipeFilter = 'all' | 'following' | 'mine' | 'saved'

/** Сводка профиля автора на pipe-странице. */
export type PipeProfile = {
  id: number
  name: string
  profile_slug: string | null
  avatar_url: string | null
  threads_count: number
  followers_count: number
  is_self: boolean
  is_following: boolean
}

/** Пагинация (формат Laravel paginator). */
export type PipePaginated<T> = {
  data: T[]
  current_page: number
  last_page: number
  total?: number
}
