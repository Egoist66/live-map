import { api } from './api'
import type { Conversation, ConversationDetail, Message, FriendshipsState } from '@/types/entities/Chat'

export const chatApi = {
  async me() {
    const { data } = await api.get('/api/chat/me')
    return data
  },
  async heartbeat() {
    const { data } = await api.post('/api/chat/heartbeat')
    return data
  },
  async search(q: string) {
    const { data } = await api.get('/api/chat/users/search', { params: { q } })
    return data
  },
  async updatePrivacy(data: { message_privacy: string; allow_random_messages: boolean }) {
    const { data: res } = await api.patch('/api/chat/privacy', data)
    return res
  },

  async friendships() {
    const { data } = await api.get<FriendshipsState & { hidden_limit?: number | null; hidden_count?: number; hidden_unlimited?: boolean }>('/api/friendships')
    return data
  },
  async toggleHidden(id: number, is_hidden?: boolean) {
    const { data } = await api.patch(`/api/friendships/${id}/hidden`, is_hidden === undefined ? {} : { is_hidden })
    return data
  },
  async publicFriends(userId: number) {
    const { data } = await api.get(`/api/users/${userId}/friends`)
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

  async conversations() {
    const { data } = await api.get<Conversation[]>('/api/conversations')
    return data
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

  async messages(convId: number, before?: number) {
    const { data } = await api.get<Message[]>(`/api/conversations/${convId}/messages`, { params: { before } })
    return data
  },
  async sendMessage(convId: number, body: string) {
    const { data } = await api.post<Message>(`/api/conversations/${convId}/messages`, { body })
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
}
