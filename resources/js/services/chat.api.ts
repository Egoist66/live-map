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
  async search(q: string, page = 1, perPage = 20) {
    const { data } = await api.get('/api/chat/users/search', { params: { q, page, per_page: perPage } })
    return data as { data: any[]; current_page: number; last_page: number; has_more: boolean } | any[]
  },
  async updatePrivacy(data: { message_privacy: string; allow_random_messages: boolean }) {
    const { data: res } = await api.patch('/api/chat/privacy', data)
    return res
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

  async conversations(page = 1, perPage = 20) {
    const { data } = await api.get<Conversation[] | { data: Conversation[]; has_more: boolean; current_page: number; last_page: number }>('/api/conversations', { params: { page, per_page: perPage } })
    if (Array.isArray(data)) return data
    if (Array.isArray((data as { data?: unknown })?.data)) return (data as { data: Conversation[] }).data
    return []
  },
  /**
   * Одна страница диалогов с метой для infinite scroll.
   *
   * @param page страница
   * @param perPage размер
   */
  async conversationsPage(page = 1, perPage = 20): Promise<{ data: Conversation[]; has_more: boolean; current_page: number; last_page: number }> {
    const { data } = await api.get('/api/conversations', { params: { page, per_page: perPage } })
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
  async deleteMessage(messageId: number) {
    const { data } = await api.delete(`/api/messages/${messageId}`)
    return data
  },
  async markDelivered(convId: number) {
    const { data } = await api.post(`/api/conversations/${convId}/delivered`)
    return data
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
}
