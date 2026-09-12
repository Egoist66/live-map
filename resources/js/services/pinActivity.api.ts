import { api } from './api'

/**
 * Элемент ленты уведомлений (единая inbox-таблица notifications;
 * id — uuid строки, старые строки pin_activities — number).
 */
export interface PinActivityItem {
  id: number | string
  kind: 'reaction' | 'comment' | 'mention' | 'photo_comment' | 'photo_like' | 'swipe_like' | 'match' | 'sub_pin' | 'sub_photo' | 'sub_level' | 'sub_flow_post' | 'flow_like' | 'flow_comment' | 'flow_reply' | 'flow_mention'
  owner_id?: number | null
  reaction_type?: string | null
  excerpt?: string | null
  comment_id?: number | null
  photo_comment_id?: number | null
  flow_post_id?: number | null
  flow_comment_id?: number | null
  read_at?: string | null
  created_at?: string | null
  pin?: { id: number; title?: string; category?: string } | null
  photo?: { id: number; user_id?: number; caption?: string | null } | null
  flow_post?: { id: number; user_id?: number } | null
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
  /**
   * Удалить всю ленту активности навсегда.
   */
  async clear() {
    const { data } = await api.delete('/api/pin-activities')
    return data
  },
}
