import { api } from './api'

export interface PinActivityItem {
  id: number
  kind: 'reaction' | 'comment' | 'mention' | 'photo_comment'
  owner_id?: number | null
  reaction_type?: string | null
  excerpt?: string | null
  comment_id?: number | null
  photo_comment_id?: number | null
  read_at?: string | null
  created_at?: string | null
  pin?: { id: number; title?: string; category?: string } | null
  photo?: { id: number; user_id?: number; caption?: string | null } | null
  actor: { id: number; name?: string; avatar_path?: string | null; avatar_url?: string | null }
}

export const pinActivityApi = {
  async list() {
    const { data } = await api.get('/api/pin-activities')
    return data?.data ?? data ?? []
  },
  async unreadCount() {
    const { data } = await api.get('/api/pin-activities/unread-count')
    return Number(data?.count ?? 0)
  },
  async markRead(ids?: number[]) {
    const { data } = await api.post('/api/pin-activities/read', ids?.length ? { ids } : { all: true })
    return data
  },
}
