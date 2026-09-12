import { api } from './api'
import type { PinActivityItem } from './pinActivity.api'

/**
 * Строка единой inbox-таблицы notifications.
 *
 * type — категория события (pin.commented, dating.matched, friend.requested,
 * security.impersonation, app.published, ...), category — таб колокольчика
 * (pin|event), data.activity — тело в форме PinActivityItem.
 */
export interface InboxNotification {
  id: string
  type: string
  category: 'pin' | 'event'
  read_at: string | null
  created_at: string | null
  updated_at?: string | null
  data: {
    activity?: PinActivityItem | null
    friendship?: any
    report?: any
    log?: any
    update?: { id: number; title?: string; body?: string; version?: string; published_at?: string | null } | null
  }
}

/**
 * Маппит строку inbox в элемент ленты (id строки — uuid).
 * @param row строка inbox
 * @returns элемент для тостов/табов/диплинков
 */
export function toActivityItem(row: InboxNotification): PinActivityItem {
  const activity = row.data?.activity ?? ({} as PinActivityItem)
  return { ...activity, id: row.id as unknown as number, read_at: row.read_at, created_at: row.created_at ?? activity.created_at }
}

export interface InboxText {
  emoji: string
  title: string
  body: string
  link: string
  avatar: string | null
}

/**
 * Текст и ссылка строки без activity (дружба, жалобы, безопасность, новости).
 * @param row строка inbox
 * @returns готовое представление для секции «Уведомления»
 */
export function describeInboxRow(row: InboxNotification): InboxText {
  const data = row.data ?? ({} as NonNullable<InboxNotification['data']>)
  if (row.type === 'friend.requested') {
    const r = data.friendship?.requester ?? {}
    const name = r.name || 'Кто-то'
    return { emoji: '💌', title: 'Заявка в друзья', body: `${name} хочет дружить`, link: '/chat?tab=requests', avatar: r.avatar_url ?? null }
  }
  if (row.type === 'friend.accepted') {
    const a = data.friendship?.addressee ?? {}
    const name = a.name || 'Пользователь'
    return { emoji: '✅', title: 'Заявка принята', body: `${name} принял заявку`, link: '/chat?tab=friends', avatar: a.avatar_url ?? null }
  }
  if (row.type === 'report.created') {
    const r = data.report ?? {}
    const title = r.target_title || `${r.target_type ?? ''} #${r.target_id ?? ''}`
    const body = (r.description ? `${r.description} — ` : '') + `от ${r.reporter?.name || 'пользователя'}`
    return { emoji: '🚩', title: `Жалоба: ${r.reason_label || r.reason || ''}`, body: `${title} · ${body}`.slice(0, 120), link: '/settings?tab=admin', avatar: r.reporter?.avatar_url ?? null }
  }
  if (row.type === 'security.impersonation') {
    const log = data.log ?? {}
    return { emoji: '🔒', title: 'Вход администрации', body: `${log.reason || 'Основание указано в журнале'}`.slice(0, 120), link: '/settings/procedures', avatar: null }
  }
  if (row.type === 'app.published') {
    const u = data.update ?? ({} as NonNullable<NonNullable<InboxNotification['data']>['update']>)
    return { emoji: '✨', title: u.title || 'Новость', body: `${u.body || ''}`.slice(0, 120), link: '', avatar: null }
  }
  return { emoji: '🔔', title: 'Уведомление', body: '', link: '/map', avatar: null }
}

export const notificationsApi = {
  async list(category?: 'pin' | 'event') {
    const { data } = await api.get('/api/notifications', { params: category ? { category, per_page: 30 } : { per_page: 30 } })
    const rows = data?.data ?? data ?? []
    return (Array.isArray(rows) ? rows : []) as InboxNotification[]
  },
  async unreadCount() {
    const { data } = await api.get('/api/notifications/unread-count')
    return {
      total: Number(data?.count ?? 0),
      pins: Number(data?.pins ?? 0),
      events: Number(data?.events ?? 0),
    }
  },
  async markRead(ids?: string[]) {
    const { data } = await api.post('/api/notifications/read', ids?.length ? { ids } : { all: true })
    return data
  },
  /**
   * Удалить ленту inbox навсегда (всю или по табу).
   */
  async clear(category?: 'pin' | 'event') {
    const { data } = await api.delete('/api/notifications', { params: category ? { category } : {} })
    return data
  },
}
