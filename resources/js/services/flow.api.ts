import { api } from '@/services/api'
import type { FlowComment, FlowCommentsSort, FlowFilter, FlowPoll, FlowPost, FlowTag } from '@/types/flow'

export type FlowPaginated<T> = {
  data: T[]
  current_page: number
  last_page: number
  total?: number
}

/**
 * API ленты UFlow.
 */
export const flowApi = {
  /**
   * Лента постов с пагинацией.
   * @param params фильтр, автор, поиск, тег, страница
   */
  async feed(params: { filter?: FlowFilter; author_id?: number | null; search?: string; tag?: string | null; post_id?: number | null; page?: number }): Promise<FlowPaginated<FlowPost>> {
    const clean: Record<string, unknown> = {}
    if (params.filter) clean.filter = params.filter
    if (params.author_id) clean.author_id = params.author_id
    if (params.search) clean.search = params.search
    if (params.tag) clean.tag = params.tag
    if (params.post_id) clean.post_id = params.post_id
    if (params.page) clean.page = params.page
    const { data } = await api.get('/api/flow-posts', { params: clean })
    if (Array.isArray((data as { data?: unknown })?.data)) return data as FlowPaginated<FlowPost>
    if (Array.isArray(data)) return { data, current_page: 1, last_page: 1 }
    return { data: [], current_page: 1, last_page: 1 }
  },

  /**
   * Создать пост (multipart: фото до 4 шт или одно видео + опрос).
   * @param payload заголовок, текст, анонимность, медиа, опрос
   */
  async create(payload: { title?: string | null; body: string; is_anonymous: boolean; image?: File | null; images?: File[]; video?: File | null; poll?: { options: string[]; closes_in_hours?: number | null } | null }): Promise<FlowPost> {
    const form = new FormData()
    if (payload.title) form.append('title', payload.title)
    form.append('body', payload.body)
    form.append('is_anonymous', payload.is_anonymous ? '1' : '0')
    if (payload.image) form.append('image', payload.image)
    for (const file of payload.images ?? []) form.append('images[]', file)
    if (payload.video) form.append('video', payload.video)
    if (payload.poll) {
      payload.poll.options.forEach((text, i) => form.append(`poll[options][${i}]`, text))
      if (payload.poll.closes_in_hours) form.append('poll[closes_in_hours]', String(payload.poll.closes_in_hours))
    }
    const { data } = await api.post('/api/flow-posts', form)
    return data as FlowPost
  },

  /**
   * Обновить свой пост.
   * @param id пост
   * @param payload поля
   */
  async update(id: number, payload: { title?: string | null; body?: string; is_anonymous?: boolean; image?: File | null; images?: File[]; video?: File | null; remove_image?: boolean; remove_media?: boolean }): Promise<FlowPost> {
    const form = new FormData()
    form.append('_method', 'PATCH')
    if (payload.title !== undefined) form.append('title', payload.title ?? '')
    if (payload.body !== undefined) form.append('body', payload.body)
    if (payload.is_anonymous !== undefined) form.append('is_anonymous', payload.is_anonymous ? '1' : '0')
    if (payload.remove_image) form.append('remove_image', '1')
    if (payload.remove_media) form.append('remove_media', '1')
    if (payload.image) form.append('image', payload.image)
    for (const file of payload.images ?? []) form.append('images[]', file)
    if (payload.video) form.append('video', payload.video)
    const { data } = await api.post(`/api/flow-posts/${id}`, form)
    return data as FlowPost
  },

  /**
   * Один пост (для живого обновления карточки).
   * @param id пост
   */
  async show(id: number): Promise<FlowPost> {
    const { data } = await api.get(`/api/flow-posts/${id}`)
    return data as FlowPost
  },

  /**
   * Репост себе на страницу, тихо или с цитатой.
   * @param id оригинал или чужой репост
   * @param comment цитата до 500 символов
   */
  async repost(id: number, comment?: string | null): Promise<FlowPost> {
    const { data } = await api.post(`/api/flow-posts/${id}/repost`, comment ? { comment } : {})
    return data as FlowPost
  },

  /**
   * Проголосовать в опросе (один голос, смена запрещена).
   * @param pollId опрос
   * @param optionId вариант
   */
  async vote(pollId: number, optionId: number): Promise<FlowPoll> {
    const { data } = await api.post(`/api/flow-polls/${pollId}/vote`, { option_id: optionId })
    return data as FlowPoll
  },

  /**
   * Закрыть опрос досрочно (автор или админ).
   * @param pollId опрос
   */
  async closePoll(pollId: number): Promise<FlowPoll> {
    const { data } = await api.post(`/api/flow-polls/${pollId}/close`)
    return data as FlowPoll
  },

  /**
   * Тренды хэштегов для чипов над лентой.
   * @param limit сколько тегов
   */
  async trendingTags(limit = 10): Promise<FlowTag[]> {
    const { data } = await api.get('/api/flow-tags/trending', { params: { limit } })
    const rows = (data as { data?: unknown })?.data ?? []
    return (Array.isArray(rows) ? rows : []) as FlowTag[]
  },

  /**
   * Удалить пост.
   * @param id пост
   */
  async remove(id: number): Promise<void> {
    await api.delete(`/api/flow-posts/${id}`)
  },

  /**
   * Лайк / анлайк.
   * @param id пост
   */
  async toggleLike(id: number): Promise<{ liked: boolean; likes_count: number }> {
    const { data } = await api.post(`/api/flow-posts/${id}/like`)
    return data
  },

  /**
   * Комментарии поста.
   * @param postId пост
   * @param page страница
   * @param sort new — сначала старые, top — сначала обсуждаемые
   */
  async comments(postId: number, page = 1, sort: FlowCommentsSort = 'new'): Promise<FlowPaginated<FlowComment>> {
    const { data } = await api.get(`/api/flow-posts/${postId}/comments`, { params: { page, sort } })
    return data as FlowPaginated<FlowComment>
  },

  /**
   * Дети ответа: ленивая подгрузка глубокой ветки (3+ уровень).
   * @param postId пост
   * @param commentId родительский ответ
   * @param page страница
   */
  async commentReplies(postId: number, commentId: number, page = 1): Promise<FlowPaginated<FlowComment>> {
    const { data } = await api.get(`/api/flow-posts/${postId}/comments/${commentId}/replies`, { params: { page } })
    return data as FlowPaginated<FlowComment>
  },

  /**
   * Создать комментарий или ответ.
   * @param postId пост
   * @param payload текст, parent_id, анонимность
   */
  async comment(postId: number, payload: { content: string; parent_id?: number | null; is_anonymous?: boolean }): Promise<FlowComment> {
    const { data } = await api.post(`/api/flow-posts/${postId}/comments`, payload)
    return data as FlowComment
  },

  /**
   * Удалить комментарий.
   * @param commentId комментарий
   */
  async removeComment(commentId: number): Promise<void> {
    await api.delete(`/api/flow-comments/${commentId}`)
  },

  /**
   * Кто может комментировать мои посты (приватность, как у фото).
   * @param flow_comments_privacy everyone|friends|none
   */
  async updateCommentsPrivacy(flow_comments_privacy: string): Promise<{ flow_comments_privacy: string }> {
    const { data } = await api.patch<{ flow_comments_privacy: string }>('/api/user/flow-comments-privacy', { flow_comments_privacy })
    return data
  },

  /**
   * Кто лайкнул пост (для тултипа и модалки лайков).
   *
   * @param postId id поста
   * @returns свежие лайки с пользователями и общее число
   */
  async likers(postId: number): Promise<{ likers: FlowLiker[]; total: number }> {
    const { data } = await api.get<{ likers: FlowLiker[]; total: number }>(`/api/flow-posts/${postId}/likers`)
    return data
  },
}

export interface FlowLiker {
  user_id: number
  name: string
  avatar_url: string | null
}
