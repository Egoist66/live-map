import { api } from './api'

/**
 * Обращение пользователя в поддержку (админка «Обращения»).
 */
export interface SupportTicket {
  id: number
  user_id: number | null
  name: string
  email: string
  subject: string
  message: string
  status: 'new' | 'answered' | 'rejected'
  admin_reply: string | null
  replied_by: number | null
  replied_at: string | null
  created_at?: string
  updated_at?: string
  user?: { id: number; name: string; avatar_path?: string | null; profile_slug?: string | null; email_verified_at?: string | null } | null
  replier?: { id: number; name: string } | null
  /** Бэк отдаёт после reply/reject: ушло ли письмо (false = только inbox). */
  mailed?: boolean
  /** Подтверждена ли почта автора на момент ответа. */
  email_verified?: boolean
  /** true когда ответ ушёл только в личку приложения. */
  inbox_only?: boolean
}

/**
 * Админ-API тикетов поддержки.
 *
 * @example
 * const { tickets } = await supportApi.tickets('new')
 * await supportApi.replyTicket(id, 'Готово, проверьте')
 */
export const supportApi = {
  /**
   * Список тикетов с фильтром статуса.
   *
   * @param status new|answered|rejected|all
   * @param page страница
   */
  async tickets(status = 'new', page = 1): Promise<{ tickets: any; new_count: number }> {
    const { data } = await api.get('/api/admin/support', { params: { status, page } })
    return data
  },
  /**
   * Ответить: письмо пользователю + статус answered.
   *
   * @param id id тикета
   * @param message текст ответа
   */
  async replyTicket(id: number, message: string): Promise<SupportTicket> {
    const { data } = await api.post(`/api/admin/support/${id}/reply`, { message })
    return data
  },
  /**
   * Отклонить: закрыть тикет, причина (если есть) уйдёт письмом.
   *
   * @param id id тикета
   * @param reason необязательная причина
   */
  async rejectTicket(id: number, reason?: string): Promise<SupportTicket> {
    const { data } = await api.post(`/api/admin/support/${id}/reject`, reason ? { reason } : {})
    return data
  },
}
