import { api } from './api'
import type { Conversation, ConversationDetail, Message, FriendshipsState } from '@/types/entities/Chat'

/**
 * Размер страницы истории чата: первые 15 при открытии, дальше по 15 вверх.
 * Совпадает с MessageController::HISTORY_PAGE_SIZE.
 */
export const CHAT_HISTORY_PAGE_SIZE = 15

export const chatApi = {
  async me() {
    const { data } = await api.get('/api/chat/me')
    return data
  },
  async heartbeat() {
    const { data } = await api.post('/api/chat/heartbeat')
    return data
  },
  /**
   * Beacon закрытия Mini App: сдвигает last_seen_at за порог isAway,
   * чтобы бот сразу слал уведомления, а не через 3 минуты.
   */
  async offline() {
    const { data } = await api.post('/api/chat/offline')
    return data
  },
  async search(q: string, page = 1, perPage = 20) {
    const { data } = await api.get('/api/chat/users/search', { params: { q, page, per_page: perPage } })
    return data as { data: any[]; current_page: number; last_page: number; has_more: boolean } | any[]
  },
  /**
   * Сохранение приватности чата — только дропдаун message_privacy.
   * @param data `{ message_privacy: everyone|friends|none }`
   */
  async updatePrivacy(data: { message_privacy: string }) {
    const { data: res } = await api.patch('/api/chat/privacy', data)
    return res
  },
  /**
   * Настройки автоответа «меня нет онлайн».
   */
  async getAutoReply() {
    const { data } = await api.get('/api/chat/auto-reply')
    return data as { enabled: boolean; text: string | null; default_text: string; has_email: boolean }
  },
  /**
   * Сохранить автоответ: вкл/выкл + свой текст (пусто = дефолтный).
   * @param payload `{ enabled: boolean; text?: string }`
   */
  async updateAutoReply(payload: { enabled: boolean; text?: string | null }) {
    const { data } = await api.patch('/api/chat/auto-reply', payload)
    return data as { enabled: boolean; text: string | null; default_text: string; has_email: boolean }
  },

  async friendships(page = 1, perPage = 20) {
    const { data } = await api.get<FriendshipsState & { hidden_limit?: number | null; hidden_count?: number; hidden_unlimited?: boolean; friends_meta?: { current_page: number; last_page: number; has_more: boolean; total: number } }>('/api/friendships', { params: { page, per_page: perPage } })
    return data
  },
  async toggleHidden(id: number, is_hidden?: boolean) {
    const { data } = await api.patch(`/api/friendships/${id}/hidden`, is_hidden === undefined ? {} : { is_hidden })
    return data
  },
  async publicFriends(userId: number, page = 1, perPage = 20) {
    const { data } = await api.get(`/api/users/${userId}/friends`, { params: { page, per_page: perPage } })
    return data
  },
  async addFriend(user_id: number) {
    const { data } = await api.post('/api/friendships', { user_id })
    return data
  },
  async accept(id: number) {
    const { data } = await api.post(`/api/friendships/${id}/accept`)
    return data
  },
  async decline(id: number) {
    const { data } = await api.post(`/api/friendships/${id}/decline`)
    return data
  },
  async removeFriend(id: number) {
    const { data } = await api.delete(`/api/friendships/${id}`)
    return data
  },
  async status(userId: number) {
    const { data } = await api.get(`/api/friendships/status/${userId}`)
    return data
  },

  async blocks() {
    const { data } = await api.get('/api/blocks')
    return data
  },
  async block(user_id: number) {
    const { data } = await api.post('/api/blocks', { user_id })
    return data
  },
  async unblock(userId: number) {
    const { data } = await api.delete(`/api/blocks/${userId}`)
    return data
  },

  /**
   * Список диалогов.
   *
   * @param page страница
   * @param perPage размер страницы
   * @param opts `onlyUnread` — вернуть только диалоги с непрочитанными
   *   входящими (панель колокольчика: без своих отправленных и без обрезки
   *   топ-страницей, иначе «прочитать всё» не гасит бейдж)
   * @returns строки диалогов
   */
  async conversations(page = 1, perPage = 20, opts: { onlyUnread?: boolean } = {}) {
    const params: Record<string, unknown> = { page, per_page: perPage }
    if (opts.onlyUnread) {
      params.only_unread = 1
    }
    const { data } = await api.get<Conversation[] | { data: Conversation[]; has_more: boolean; current_page: number; last_page: number }>('/api/conversations', { params })
    if (Array.isArray(data)) return data
    if (Array.isArray((data as { data?: unknown })?.data)) return (data as { data: Conversation[] }).data
    return []
  },
  /**
   * Дельта-синк списка диалогов для offline-кеша.
   *
   * @param sinceMs курсор прошлого синка (server_time, ms)
   * @returns изменившиеся диалоги + id удалённых у себя + свежий server_time
   */
  async syncConversations(sinceMs: number): Promise<{ data: Conversation[]; removed_ids: number[]; server_time: number }> {
    const { data } = await api.get('/api/conversations/sync', { params: { since: sinceMs || undefined } })
    return {
      data: Array.isArray((data as { data?: unknown })?.data) ? (data as { data: Conversation[] }).data : [],
      removed_ids: Array.isArray((data as { removed_ids?: unknown })?.removed_ids)
        ? (data as { removed_ids: number[] }).removed_ids.map((id) => Number(id)).filter((id) => id > 0)
        : [],
      server_time: Number((data as { server_time?: number })?.server_time ?? 0),
    }
  },
  /**
   * Одна страница диалогов с метой для infinite scroll.
   *
   * @param page страница
   * @param perPage размер
   * @param opts `onlyDirect` — только личные, `onlyMatched` — только мэтчи
   */
  async conversationsPage(
    page = 1,
    perPage = 20,
    opts: { onlyDirect?: boolean; onlyMatched?: boolean } = {},
  ): Promise<{ data: Conversation[]; has_more: boolean; current_page: number; last_page: number }> {
    const params: Record<string, unknown> = { page, per_page: perPage }
    if (opts.onlyDirect) {
      params.only_direct = 1
    }
    if (opts.onlyMatched) {
      params.only_matched = 1
    }
    const { data } = await api.get('/api/conversations', { params })
    if (Array.isArray(data)) return { data, has_more: false, current_page: 1, last_page: 1 }
    const rows = Array.isArray((data as { data?: unknown })?.data) ? (data as { data: Conversation[] }).data : []
    return {
      data: rows,
      has_more: !!(data as { has_more?: boolean })?.has_more,
      current_page: Number((data as { current_page?: number })?.current_page ?? page),
      last_page: Number((data as { last_page?: number })?.last_page ?? page),
    }
  },
  async createConversation(user_id: number, message?: string) {
    const { data } = await api.post('/api/conversations', { user_id, message })
    return data
  },
  async getConversation(id: number) {
    const { data } = await api.get<ConversationDetail>(`/api/conversations/${id}`)
    return data
  },
  async markRead(id: number) {
    const { data } = await api.post(`/api/conversations/${id}/read`)
    return data
  },
  async deleteConversation(id: number) {
    const { data } = await api.delete(`/api/conversations/${id}`)
    return data
  },
  /**
   * Закрепить диалог у себя: висит всегда сверху (как в Telegram).
   * @param id id диалога
   */
  async pinConversation(id: number) {
    const { data } = await api.post(`/api/conversations/${id}/pin`)
    return data as { ok: boolean; is_pinned: boolean; pinned_at: string | null }
  },
  /**
   * Открепить диалог: вернётся в общий порядок по времени.
   * @param id id диалога
   */
  async unpinConversation(id: number) {
    const { data } = await api.delete(`/api/conversations/${id}/pin`)
    return data as { ok: boolean; is_pinned: boolean; pinned_at: string | null }
  },
  /**
   * Прямой URL выгрузки переписки в HTML (скачивание через useFileDownload).
   * @param id id диалога
   */
  exportConversationHtmlUrl(id: number) {
    return `/api/conversations/${id}/export`
  },
  /**
   * Убрать все диалоги из своего списка навсегда.
   */
  async clearConversations() {
    const { data } = await api.delete('/api/conversations')
    return data
  },

  async messages(convId: number, before?: number, limit = CHAT_HISTORY_PAGE_SIZE) {
    const { data } = await api.get<Message[] | { data: Message[]; has_more: boolean }>(`/api/conversations/${convId}/messages`, { params: { before, limit } })
    // Бэк отдаёт {data, has_more}; старые кэши могли отдать массив — нормализуем оба.
    if (Array.isArray(data)) return data
    if (Array.isArray((data as { data?: unknown })?.data)) return data as unknown as Message[]
    return [] as Message[]
  },
  /**
   * Страница истории с флагом has_more для infinite scroll вверх.
   *
   * @param convId id диалога
   * @param before грузить старше этого id
   * @param limit размер страницы
   */
  async messagesPage(convId: number, before?: number, limit = CHAT_HISTORY_PAGE_SIZE): Promise<{ data: Message[]; has_more: boolean }> {
    const { data } = await api.get(`/api/conversations/${convId}/messages`, { params: { before, limit } })
    if (Array.isArray(data)) return { data, has_more: data.length >= limit }
    return {
      data: Array.isArray((data as { data?: unknown })?.data) ? (data as { data: Message[] }).data : [],
      has_more: !!(data as { has_more?: boolean })?.has_more,
    }
  },
  /**
   * Дельта-синк открытого диалога: всё новее известного id.
   *
   * @param convId id диалога
   * @param afterId последний известный id
   */
  async messagesAfter(convId: number, afterId: number): Promise<Message[]> {
    const { data } = await api.get(`/api/conversations/${convId}/messages`, { params: { after: afterId, limit: 50 } })
    if (Array.isArray(data)) return data
    if (Array.isArray((data as { data?: unknown })?.data)) return (data as { data: Message[] }).data
    return []
  },
  async sendMessage(convId: number, body: string, replyToId?: number | null, attachment?: File | null, voiceDuration?: number | null) {
    if (!attachment) {
      const { data } = await api.post<Message>(`/api/conversations/${convId}/messages`, { body, reply_to_id: replyToId ?? null })
      return data
    }
    const form = new FormData()
    form.append('body', body || '')
    if (replyToId != null) form.append('reply_to_id', String(replyToId))
    if (voiceDuration != null) form.append('voice_duration', String(voiceDuration))
    form.append('attachment', attachment, attachment.name)
    const { data } = await api.post<Message>(`/api/conversations/${convId}/messages`, form)
    return data
  },
  async editMessage(messageId: number, body: string) {
    const { data } = await api.patch<Message>(`/api/messages/${messageId}`, { body })
    return data
  },
  /**
   * Поделиться постом в личке с одним или несколькими пользователями.
   * Каждому создаётся/находится direct-диалог, туда падает message типа post.
   * @param payload получатели, тип и id поста, сопроводительный текст
   */
  async sharePost(payload: { user_ids: number[]; post_type: 'flow' | 'district'; post_id: number; comment?: string | null }) {
    const { data } = await api.post('/api/chat/share-post', {
      user_ids: payload.user_ids,
      post_type: payload.post_type,
      post_id: payload.post_id,
      comment: payload.comment ?? null,
    })
    return data as { sent: { conversation_id: number; message: Message }[]; skipped: { user_id: number; reason: string }[] }
  },
  async deleteMessage(messageId: number) {
    const { data } = await api.delete(`/api/messages/${messageId}`)
    return data
  },
  /**
   * Удалить несколько своих сообщений одним запросом (мультиселект).
   * @param ids id сообщений
   */
  async bulkDeleteMessages(ids: number[]) {
    const { data } = await api.post<{ ok: boolean; deleted: number[] }>('/api/messages/bulk-delete', { ids })
    return data
  },
  /**
   * Переслать сообщения в свои диалоги (как в Telegram).
   * @param messageIds что пересылаем
   * @param conversationIds куда пересылаем
   */
  async forwardMessages(messageIds: number[], conversationIds: number[]) {
    const { data } = await api.post<{ ok: boolean; results: { conversation_id: number; messages: Message[] }[] }>('/api/messages/forward', { message_ids: messageIds, conversation_ids: conversationIds })
    return data
  },
  async markDelivered(convId: number) {
    const { data } = await api.post(`/api/conversations/${convId}/delivered`)
    return data
  },
  /**
   * Общий фон беседы: применяется у всех участников сразу.
   * @param convId id диалога
   * @param payload пресет/цвет/сброс; картинка — File через multipart
   */
  async updateWallpaper(convId: number, payload: { type: 'none' | 'preset' | 'color' | 'image'; preset?: string | null; color?: string | null; image?: File | null }) {
    if (payload.image instanceof File) {
      const form = new FormData()
      form.append('type', 'image')
      form.append('image', payload.image, payload.image.name)
      const { data } = await api.post(`/api/conversations/${convId}/wallpaper`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return (data as { wallpaper: unknown }).wallpaper
    }
    const body: Record<string, unknown> = { type: payload.type }
    if (payload.type === 'preset') body.preset = payload.preset
    if (payload.type === 'color') body.color = payload.color
    const { data } = await api.patch(`/api/conversations/${convId}/wallpaper`, body)
    return (data as { wallpaper: unknown }).wallpaper
  },
  /**
   * Шлёт серверный typing-сигнал: бэкенд транслирует его через Reverb
   * событием `.typing`. Дублирует whisper, который Reverb режет
   * на приватных каналах.
   * @param convId id диалога
   * @param isTyping печатает или перестал
   */
  async typing(convId: number, isTyping: boolean) {
    const { data } = await api.post(`/api/conversations/${convId}/typing`, { is_typing: isTyping })
    return data
  },
  async pinnedMessages(convId: number) {
    const { data } = await api.get<{ pinned: Message[]; pin_limit: number | null }>(`/api/conversations/${convId}/pinned`)
    return data
  },
  async pinMessage(messageId: number) {
    const { data } = await api.post<Message>(`/api/messages/${messageId}/pin`)
    return data
  },
  async unpinMessage(messageId: number) {
    const { data } = await api.delete<Message>(`/api/messages/${messageId}/pin`)
    return data
  },
  async attachments(page = 1) {
    const { data } = await api.get('/api/chat/attachments', { params: { page } })
    return data
  },
  async deleteAttachment(messageId: number) {
    const { data } = await api.delete(`/api/chat/attachments/${messageId}`)
    return data
  },
  async clearAttachments() {
    const { data } = await api.delete('/api/chat/attachments')
    return data
  },
  downloadArchiveUrl() {
    return '/api/chat/attachments/download-all'
  },
}
