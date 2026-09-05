import { api } from './api'
import type { Conversation, ConversationDetail, Message, FriendshipsState } from '@/types/entities/Chat'

export const chatApi = {
  me() { return api.get('/api/chat/me').then(r=>r.data) },
  heartbeat() { return api.post('/api/chat/heartbeat').then(r=>r.data) },
  search(q:string){ return api.get('/api/chat/users/search',{params:{q}}).then(r=>r.data) },
  updatePrivacy(data:{message_privacy:string,allow_random_messages:boolean}){ return api.patch('/api/chat/privacy',data).then(r=>r.data) },

  friendships(){ return api.get<FriendshipsState & { hidden_limit?: number|null; hidden_count?: number; hidden_unlimited?: boolean }>('/api/friendships').then(r=>r.data) },
  toggleHidden(id:number, is_hidden?:boolean){ return api.patch(`/api/friendships/${id}/hidden`, is_hidden===undefined?{}:{is_hidden}).then(r=>r.data) },
  publicFriends(userId:number){ return api.get(`/api/users/${userId}/friends`).then(r=>r.data) },
  addFriend(user_id:number){ return api.post('/api/friendships',{user_id}).then(r=>r.data) },
  accept(id:number){ return api.post(`/api/friendships/${id}/accept`).then(r=>r.data) },
  decline(id:number){ return api.post(`/api/friendships/${id}/decline`).then(r=>r.data) },
  removeFriend(id:number){ return api.delete(`/api/friendships/${id}`).then(r=>r.data) },
  status(userId:number){ return api.get(`/api/friendships/status/${userId}`).then(r=>r.data) },

  blocks(){ return api.get('/api/blocks').then(r=>r.data) },
  block(user_id:number){ return api.post('/api/blocks',{user_id}).then(r=>r.data) },
  unblock(userId:number){ return api.delete(`/api/blocks/${userId}`).then(r=>r.data) },

  conversations(){ return api.get<Conversation[]>('/api/conversations').then(r=>r.data) },
  createConversation(user_id:number, message?:string){ return api.post('/api/conversations',{user_id,message}).then(r=>r.data) },
  getConversation(id:number){ return api.get<ConversationDetail>(`/api/conversations/${id}`).then(r=>r.data) },
  markRead(id:number){ return api.post(`/api/conversations/${id}/read`).then(r=>r.data) },
  deleteConversation(id:number){ return api.delete(`/api/conversations/${id}`).then(r=>r.data) },

  messages(convId:number, before?:number){ return api.get<Message[]>(`/api/conversations/${convId}/messages`,{params:{before}}).then(r=>r.data) },
  sendMessage(convId:number, body:string){ return api.post<Message>(`/api/conversations/${convId}/messages`,{body}).then(r=>r.data) },
  editMessage(messageId:number, body:string){ return api.patch<Message>(`/api/messages/${messageId}`,{body}).then(r=>r.data) },
  deleteMessage(messageId:number){ return api.delete(`/api/messages/${messageId}`).then(r=>r.data) },
  markDelivered(convId:number){ return api.post(`/api/conversations/${convId}/delivered`).then(r=>r.data) },
}
