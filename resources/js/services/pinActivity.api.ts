import { api } from './api'

export interface PinActivityItem {
  id: number
  kind: 'reaction' | 'comment' | 'mention'
  reaction_type?: string | null
  excerpt?: string | null
  comment_id?: number | null
  read_at?: string | null
  created_at?: string | null
  pin: { id: number; title?: string; category?: string }
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
