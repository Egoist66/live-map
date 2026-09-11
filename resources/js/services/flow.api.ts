import { api } from '@/services/api'
import type { FlowComment, FlowFilter, FlowPost } from '@/types/flow'

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
   * @param params фильтр, автор, поиск, страница
   */
  async feed(params: { filter?: FlowFilter; author_id?: number | null; search?: string; post_id?: number | null; page?: number }): Promise<FlowPaginated<FlowPost>> {
    const clean: Record<string, unknown> = {}
    if (params.filter) clean.filter = params.filter
    if (params.author_id) clean.author_id = params.author_id
    if (params.search) clean.search = params.search
    if (params.post_id) clean.post_id = params.post_id
    if (params.page) clean.page = params.page
    const { data } = await api.get('/api/flow-posts', { params: clean })
    if (Array.isArray((data as { data?: unknown })?.data)) return data as FlowPaginated<FlowPost>
    if (Array.isArray(data)) return { data, current_page: 1, last_page: 1 }
    return { data: [], current_page: 1, last_page: 1 }
  },

  /**
   * Создать пост (multipart при картинке).
   * @param payload заголовок, текст, анонимность, файл
   */
  async create(payload: { title?: string | null; body: string; is_anonymous: boolean; image?: File | null }): Promise<FlowPost> {
    const form = new FormData()
    if (payload.title) form.append('title', payload.title)
    form.append('body', payload.body)
    form.append('is_anonymous', payload.is_anonymous ? '1' : '0')
    if (payload.image) form.append('image', payload.image)
    const { data } = await api.post('/api/flow-posts', form)
    return data as FlowPost
  },

  /**
   * Обновить свой пост.
   * @param id пост
   * @param payload поля
   */
  async update(id: number, payload: { title?: string | null; body?: string; is_anonymous?: boolean; image?: File | null; remove_image?: boolean }): Promise<FlowPost> {
    const form = new FormData()
    form.append('_method', 'PATCH')
    if (payload.title !== undefined) form.append('title', payload.title ?? '')
    if (payload.body !== undefined) form.append('body', payload.body)
    if (payload.is_anonymous !== undefined) form.append('is_anonymous', payload.is_anonymous ? '1' : '0')
    if (payload.remove_image) form.append('remove_image', '1')
    if (payload.image) form.append('image', payload.image)
    const { data } = await api.post(`/api/flow-posts/${id}`, form)
    return data as FlowPost
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
   */
  async comments(postId: number, page = 1): Promise<FlowPaginated<FlowComment>> {
    const { data } = await api.get(`/api/flow-posts/${postId}/comments`, { params: { page } })
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
}
