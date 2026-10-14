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
    district?: any
    report?: any
    log?: any
    new_device?: { device_id?: number; device_label?: string; city?: string | null; country?: string | null; ip?: string | null } | null
    business?: { id?: number; name?: string; verification_status?: string; verification_notes?: string | null; unp?: string | null } | null
    cooperation?: { company?: string; email?: string; message?: string | null } | null
    support?: { ticket_id?: number; subject?: string; message?: string; name?: string; email?: string } | null
    support_answer?: { ticket_id?: number; subject?: string; reply?: string } | null
    sos_chat_closed?: { conversation_id?: number; reason?: string; reason_label?: string; pin_title?: string | null } | null
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
  /** Прямое скачивание по клику вместо перехода (история SOS-чата). */
  downloadUrl?: string | null
  /** Имя файла для скачивания по клику. */
  fileName?: string | null
}

/**
 * Слово-субъект для текстов уведомлений: организация или пользователь.
 *
 * Организации (ООО/ИП — is_organization в пейлоаде актора) именуются
 * «Организация», все остальные — «Пользователь».
 *
 * @param actor актор из пейлоада (requester/accepter/reporter/actor)
 * @returns Организация|Пользователь
 * @example subjectWord(row.data.district?.requester) // 'Организация'
 */
export function subjectWord(actor: unknown): 'Организация' | 'Пользователь' {
  try {
    const person = actor as Record<string, unknown> | null
    if (person && person.is_organization === true) return 'Организация'
    if (person && String(person.account_type ?? '') === 'business' && !('is_organization' in (person as object))) {
      return 'Организация'
    }
  } catch {}
  return 'Пользователь'
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
    const verb = subjectWord(a) === 'Организация' ? 'приняла заявку' : 'принял заявку'
    return { emoji: '✅', title: 'Заявка принята', body: `${name} ${verb}`, link: '/chat?tab=friends', avatar: a.avatar_url ?? null }
  }
  if (row.type === 'district.join_requested') {
    const d = (data as any).district ?? {}
    const name = d.requester?.name || 'Кто-то'
    const subject = subjectWord(d.requester)
    const purpose = String(d.request_message ?? d.requester?.request_message ?? '').trim()
    const purposeSuffix = purpose !== '' ? ` · Цель: ${purpose.slice(0, 80)}` : ''
    return { emoji: '🏘️', title: `${subject} ${name} — заявка в район`, body: `${subject} ${name} отправил заявку на вступление в район «${d.name || ''}»${purposeSuffix}`, link: `/districts/${d.id || ''}`, avatar: d.requester?.avatar_url ?? null }
  }
  if (row.type === 'district.request_approved') {
    const d = (data as any).district ?? {}
    return { emoji: '🎉', title: `Вы в районе «${d.name || ''}»`, body: 'Пины района и общий чат открыты', link: `/districts/${d.id || ''}`, avatar: null }
  }
  if (row.type === 'district.request_rejected') {
    const d = (data as any).district ?? {}
    return { emoji: '🚫', title: `Заявка в «${d.name || ''}» отклонена`, body: 'Владелец решил не пускать — можно написать ему в личку', link: `/districts/${d.id || ''}`, avatar: null }
  }
  if (row.type === 'district.invited') {
    const d = (data as any).district ?? {}
    const name = d.inviter?.name || 'Владелец'
    return { emoji: '🎫', title: `Приглашение в район «${d.name || ''}»`, body: `${name} зовёт в жители — примите или отклоните`, link: `/districts/${d.id || ''}`, avatar: d.inviter?.avatar_url ?? null }
  }
  if (row.type === 'district.invite_accepted') {
    const d = (data as any).district ?? {}
    const name = d.accepter?.name || 'Новый житель'
    const verb = subjectWord(d.accepter) === 'Организация' ? 'приняла приглашение' : 'принял приглашение'
    return { emoji: '✅', title: `${name} ${verb}`, body: `Район «${d.name || ''}» — пины и чат открыты`, link: `/districts/${d.id || ''}`, avatar: d.accepter?.avatar_url ?? null }
  }
  if (row.type === 'district.pin_created') {
    const d = (data as any).district ?? {}
    const pinTitle = String(d.pin_title || '').slice(0, 60)
    return { emoji: '📍', title: `Новый пин в «${d.name || ''}»`, body: pinTitle ? `«${pinTitle}»` : 'Житель поставил пин внутри', link: `/districts/${d.id || ''}`, avatar: (data as any)?.activity?.actor?.avatar_url ?? null }
  }
  if (row.type === 'district.post_published') {
    const d = (data as any).district ?? {}
    const postTitle = String(d.post_title || d.post_excerpt || '').slice(0, 80)
    return { emoji: '📢', title: `Новость в «${d.name || ''}»`, body: postTitle || 'Владелец опубликовал новость', link: `/districts/${d.id || ''}`, avatar: (data as any)?.activity?.actor?.avatar_url ?? null }
  }
  if (row.type === 'district.post_commented') {
    const d = (data as any).district ?? {}
    return { emoji: '💬', title: `Комментарий в «${d.name || ''}»`, body: String(d.excerpt || 'Новый комментарий').slice(0, 80), link: `/districts/${d.id || ''}`, avatar: (data as any)?.activity?.actor?.avatar_url ?? null }
  }
  if (row.type === 'district.post_replied') {
    const d = (data as any).district ?? {}
    return { emoji: '↩️', title: `Ответ в «${d.name || ''}»`, body: String(d.excerpt || 'Ответили на комментарий').slice(0, 80), link: `/districts/${d.id || ''}`, avatar: (data as any)?.activity?.actor?.avatar_url ?? null }
  }
  if (row.type === 'district.post_liked') {
    const d = (data as any).district ?? {}
    return { emoji: '❤️', title: `Лайк в «${d.name || ''}»`, body: 'Оценили вашу новость', link: `/districts/${d.id || ''}`, avatar: (data as any)?.activity?.actor?.avatar_url ?? null }
  }
  if (row.type === 'report.created') {
    const r = data.report ?? {}
    const title = r.target_title || `${r.target_type ?? ''} #${r.target_id ?? ''}`
    const from = r.reporter?.name ? r.reporter.name : subjectWord(r.reporter) === 'Организация' ? 'организации' : 'пользователя'
    const body = (r.description ? `${r.description} — ` : '') + `от ${from}`
    return { emoji: '🚩', title: `Жалоба: ${r.reason_label || r.reason || ''}`, body: `${title} · ${body}`.slice(0, 120), link: '/settings/admin', avatar: r.reporter?.avatar_url ?? null }
  }
  if (row.type === 'security.impersonation') {
    const log = data.log ?? {}
    return { emoji: '🔒', title: 'Служебный вход', body: `${log.reason || 'Основание указано в журнале'}`.slice(0, 120), link: '/settings/procedures', avatar: null }
  }
  if (row.type === 'security.new_device') {
    const d = (data as any).new_device ?? {}
    const label = d.device_label || 'Новое устройство'
    const place = [d.city, d.country, d.ip].filter((x: unknown) => String(x ?? '').trim() !== '').join(' · ')
    return { emoji: '🔐', title: 'Вход с нового устройства', body: `${label}${place ? ` · ${place}` : ''}`.slice(0, 120), link: '/settings', avatar: null }
  }
  if (row.type === 'business.submitted') {
    const b = data.business ?? {}
    const name = String(b.name || 'Компания').slice(0, 60)
    return { emoji: '💼', title: 'Новая заявка бизнеса', body: `${name} — проверка по УНП${b.unp ? ` ${b.unp}` : ''}`.slice(0, 120), link: '/admin/business', avatar: null }
  }
  if (row.type === 'business.verified') {
    const b = data.business ?? {}
    const name = String(b.name || 'Компания').slice(0, 60)
    return { emoji: '✅', title: 'Компания проверена', body: `${name} — бейдж «Проверено» включён`.slice(0, 120), link: '/cabinet', avatar: null }
  }
  if (row.type === 'business.rejected') {
    const b = data.business ?? {}
    const reason = String(b.verification_notes || '').slice(0, 80)
    return { emoji: '❌', title: 'Проверка отклонена', body: (reason || `${b.name || 'Бизнес'} — исправьте реквизиты и отправьте снова`).slice(0, 120), link: '/cabinet/onboarding', avatar: null }
  }
  if (row.type === 'cooperation.request') {
    const c = data.cooperation ?? {}
    const company = String(c.company || '').slice(0, 60)
    const message = String(c.message || 'Хотят обсудить сотрудничество').slice(0, 60)
    return { emoji: '🤝', title: `Сотрудничество: ${company}`, body: `${message} — ${c.email || ''}`.slice(0, 120), link: '/admin', avatar: null }
  }
  if (row.type === 'support.request') {
    const s = data.support ?? {}
    const subject = String(s.subject || 'Обращение').slice(0, 60)
    const message = String(s.message || 'Новое обращение').slice(0, 60)
    return { emoji: '🛟', title: `Поддержка: ${subject}`, body: `${message} — ${s.name || s.email || ''}`.slice(0, 120), link: '/admin/support', avatar: null }
  }
  if (row.type === 'support.answered') {
    const s = data.support_answer ?? {}
    const subject = String(s.subject || 'обращение').slice(0, 60)
    const reply = String(s.reply || 'Вам ответили').slice(0, 80)
    return { emoji: '💬', title: `Поддержка ответила: ${subject}`, body: reply.slice(0, 120), link: '/settings/support', avatar: null }
  }
  if (row.type === 'sos.chat_closed') {
    const s = (data as any).sos_chat_closed ?? {}
    const pinTitle = s.pin_title ? `: ${s.pin_title}` : ''
    return {
      emoji: '🆘',
      title: `SOS-чат закрыт${pinTitle}`.slice(0, 120),
      body: 'Нажмите, чтобы скачать историю чата.'.slice(0, 120),
      link: String(s.archive_download_url || s.archive_url || '/chat'),
      avatar: null,
      downloadUrl: String(s.archive_download_url || s.archive_url || '') || null,
      fileName: String(s.archive_name || 'SOS-чат.txt'),
    }
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
