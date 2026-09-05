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
  list() {
    return api.get('/api/pin-activities').then((r) => r.data?.data ?? r.data ?? [])
  },
  unreadCount() {
    return api.get('/api/pin-activities/unread-count').then((r) => Number(r.data?.count ?? 0))
  },
  markRead(ids?: number[]) {
    return api.post('/api/pin-activities/read', ids?.length ? { ids } : { all: true }).then((r) => r.data)
  },
}
