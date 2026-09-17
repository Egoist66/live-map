import { api } from './api'

/**
 * Элемент ленты уведомлений (единая inbox-таблица notifications;
 * id — uuid строки, старые строки pin_activities — number).
 */
export interface PinActivityItem {
  id: number | string
  kind: 'reaction' | 'comment' | 'mention' | 'photo_comment' | 'photo_like' | 'swipe_like' | 'match' | 'sub_pin' | 'sub_photo' | 'sub_level' | 'sub_flow_post' | 'flow_like' | 'flow_comment' | 'flow_reply' | 'flow_mention' | 'invite' | 'invite_accepted'
  owner_id?: number | null
  reaction_type?: string | null
  excerpt?: string | null
  comment_id?: number | null
  photo_comment_id?: number | null
  flow_post_id?: number | null
  flow_comment_id?: number | null
  invite_id?: number | null
  pin_id?: number | null
  read_at?: string | null
  created_at?: string | null
  pin?: { id: number; title?: string; category?: string } | null
  photo?: { id: number; user_id?: number; caption?: string | null } | null
  flow_post?: { id: number; user_id?: number } | null
  actor: { id: number; name?: string; avatar_path?: string | null; avatar_url?: string | null }
}

/**
 * Legacy-фасад ленты активности.
 *
 * Старые эндпоинты `/api/pin-activities*` удалены (таблица pin_activities
 * дропнута миграцией 2026_10_03_000002), единый inbox — `/api/notifications*`.
 * Методы сохранены для совместимости и проксируют в notifications,
 * чтобы клик по районам/профилю не давал 404.
 */
export const pinActivityApi = {
  async list() {
    const { data } = await api.get('/api/notifications', { params: { per_page: 30 } })
    const rows = data?.data ?? data ?? []
    const list = Array.isArray(rows) ? rows : []
    return list.map((row: any) => ({ ...(row?.data?.activity ?? {}), id: row?.id, read_at: row?.read_at, created_at: row?.created_at }))
  },
  async unreadCount() {
    const { data } = await api.get('/api/notifications/unread-count')
    return Number(data?.count ?? 0)
  },
  async markRead(ids?: Array<number | string>) {
    const payload = ids?.length ? { ids: ids.map((id) => String(id)) } : { all: true }
    const { data } = await api.post('/api/notifications/read', payload)
    return data
  },
  /**
   * Удалить всю ленту активности навсегда.
   */
  async clear() {
    const { data } = await api.delete('/api/notifications')
    return data
  },
}
