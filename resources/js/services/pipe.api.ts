import { api } from '@/services/api'
import type { PipeFilter, PipePaginated, PipeProfile, PipeReply, PipeThread } from '@/types/pipe'

/**
 * API мини-приложения Pipe (pipe.ulove.by).
 *
 * Один слой axios: все проверки видимости и модерации — на сервере,
 * при 401/403 фронт лишь аккуратно переводит гостя в read-only.
 */
export const pipeApi = {
  /**
   * Лента тредов с пагинацией.
   * @param params фильтр, автор, диплинк-тред, поиск, страница
   */
  async feed(params: { filter?: PipeFilter; author_id?: number | null; thread_id?: number | null; search?: string; page?: number }): Promise<PipePaginated<PipeThread>> {
    const clean: Record<string, unknown> = {}
    if (params.filter) clean.filter = params.filter
    if (params.author_id) clean.author_id = params.author_id
    if (params.search) clean.search = params.search
    if (params.thread_id) clean.thread_id = params.thread_id
    if (params.page) clean.page = params.page
    const { data } = await api.get('/api/pipe/threads', { params: clean })
    if (Array.isArray((data as { data?: unknown })?.data)) return data as PipePaginated<PipeThread>
    if (Array.isArray(data)) return { data, current_page: 1, last_page: 1 }
    return { data: [], current_page: 1, last_page: 1 }
  },

  /**
   * Создать pipe: текст (может быть пуст при картинках) + до 3 фото.
   *
   * @param payload текст, флаг анонимности, оптимизированные картинки
   */
  async create(payload: { body: string; is_anonymous: boolean; images?: File[] }): Promise<PipeThread> {
    const form = new FormData()
    form.append('body', payload.body)
    form.append('is_anonymous', payload.is_anonymous ? '1' : '0')
    for (const image of payload.images ?? []) {
      form.append('images[]', image)
    }
    const { data } = await api.post('/api/pipe/threads', form)
    return data as PipeThread
  },

  /**
   * Редактировать свой pipe.
   * @param id pipe
   * @param payload новый текст (до 500)
   */
  async update(id: number, payload: { body: string }): Promise<PipeThread> {
    const { data } = await api.put(`/api/pipe/threads/${id}`, payload)
    return data as PipeThread
  },

  /**
   * Один тред (диплинк и живое обновление карточки).
   * @param id тред
   */
  async show(id: number): Promise<PipeThread> {
    const { data } = await api.get(`/api/pipe/threads/${id}`)
    return data as PipeThread
  },

  /**
   * Удалить свой тред (или админский).
   * @param id тред
   */
  async remove(id: number): Promise<void> {
    await api.delete(`/api/pipe/threads/${id}`)
  },

  /**
   * Лайк / анлайк треда.
   * @param id тред
   */
  async toggleLike(id: number): Promise<{ liked: boolean; likes_count: number }> {
    const { data } = await api.post(`/api/pipe/threads/${id}/like`)
    return data
  },

  /**
   * Сохранить тред в избранное / убрать закладку.
   * @param id тред
   */
  async toggleSave(id: number): Promise<{ saved: boolean }> {
    const { data } = await api.post(`/api/pipe/threads/${id}/save`)
    return data
  },

  /**
   * Ответы треда: верхний уровень постранично + полное дерево потомков.
   * @param threadId тред
   * @param page страница
   */
  async replies(threadId: number, page = 1): Promise<PipePaginated<PipeReply>> {
    const { data } = await api.get(`/api/pipe/threads/${threadId}/replies`, { params: { page } })
    return data as PipePaginated<PipeReply>
  },

  /**
   * Создать ответ (на тред или на ответ).
   * @param threadId тред
   * @param payload текст, parent_id, анонимность
   */
  async createReply(threadId: number, payload: { body: string; parent_id?: number | null; is_anonymous?: boolean }): Promise<PipeReply> {
    const body: Record<string, unknown> = { body: payload.body }
    if (payload.parent_id) body.parent_id = payload.parent_id
    if (payload.is_anonymous !== undefined) body.is_anonymous = payload.is_anonymous
    const { data } = await api.post(`/api/pipe/threads/${threadId}/replies`, body)
    return data as PipeReply
  },

  /**
   * Удалить свой ответ.
   * @param replyId ответ
   */
  async removeReply(replyId: number): Promise<void> {
    await api.delete(`/api/pipe/replies/${replyId}`)
  },

  /**
   * Лайк / анлайк ответа.
   * @param replyId ответ
   */
  async toggleReplyLike(replyId: number): Promise<{ liked: boolean; likes_count: number }> {
    const { data } = await api.post(`/api/pipe/replies/${replyId}/like`)
    return data
  },

  /**
   * Закрепить / открепить ответ (только автор треда, максимум 3).
   * @param replyId ответ
   */
  async toggleReplyPin(replyId: number): Promise<{ id: number; pinned: boolean }> {
    const { data } = await api.post(`/api/pipe/replies/${replyId}/pin`)
    return data as { id: number; pinned: boolean }
  },

  /**
   * Обновить свой ответ (чужой запрещено даже админу).
   * @param replyId ответ
   * @param body новый текст
   */
  async updateReply(replyId: number, body: string): Promise<PipeReply> {
    const { data } = await api.put(`/api/pipe/replies/${replyId}`, { body })
    return data as PipeReply
  },

  /**
   * Статус профиля автора: треды чьи, подписан ли, счётчики.
   * @param userId автор
   */
  async profileStatus(userId: number): Promise<PipeProfile> {
    const { data } = await api.get(`/api/pipe/profile/${userId}/status`)
    return data as PipeProfile
  },

  /**
   * Подписаться / отписаться на автора.
   * @param userId автор
   */
  async toggleFollow(userId: number): Promise<{ following: boolean }> {
    const { data } = await api.post(`/api/pipe/profile/${userId}/follow`)
    return data
  },

  /**
   * Жалоба на тред или ответ (в админку модерации).
   * @param targetType pipe_thread | pipe_reply
   * @param targetId id цели
   * @param reason причина из списка бэка
   */
  async report(targetType: 'pipe_thread' | 'pipe_reply', targetId: number, reason: string, description?: string): Promise<void> {
    await api.post('/api/reports', {
      target_type: targetType,
      target_id: targetId,
      reason,
      description: description || undefined,
    })
  },
}

/** Лайкнувший пользователь (модалка лайков). */
export interface PipeLiker {
  user_id: number
  name: string
  profile_slug?: string | null
  avatar_url: string | null
}
