import { api } from './api'
import type { CreateDistrictPayload, District, DistrictDetails, DistrictResident } from '@/types/entities/District'

/**
 * API UDistrict-районов: слой заливок, заявки, жители.
 */
export const districtsApi = {
  /**
   * Районы в прямоугольнике карты (или свои при mine).
   */
  async list(bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null, mine = false): Promise<District[]> {
    const params: Record<string, unknown> = {}
    if (mine) {
      params.mine = 1
    } else if (bbox) {
      params.min_lat = bbox.minLat
      params.max_lat = bbox.maxLat
      params.min_lng = bbox.minLng
      params.max_lng = bbox.maxLng
    }
    const { data } = await api.get<District[]>('/api/districts', { params })
    return Array.isArray(data) ? data : []
  },

  /**
   * Глобальный поиск районов по названию для таба «Районы».
   *
   * @param query строка поиска (мин. 2 символа)
   * @param page страница для infinite scroll
   */
  async search(query: string, page = 1): Promise<{ data: District[]; current_page: number; last_page: number; has_more: boolean }> {
    const { data } = await api.get('/api/districts', { params: { search: query.trim(), page } })
    if (Array.isArray(data)) return { data, current_page: 1, last_page: 1, has_more: false }
    const rows = Array.isArray((data as { data?: unknown })?.data) ? (data as { data: District[] }).data : []
    return {
      data: rows,
      current_page: Number((data as { current_page?: number })?.current_page ?? page),
      last_page: Number((data as { last_page?: number })?.last_page ?? page),
      has_more: !!(data as { has_more?: boolean })?.has_more,
    }
  },

  /**
   * Создать район из заливки кисти.
   */
  async create(payload: CreateDistrictPayload): Promise<DistrictDetails> {
    const { data } = await api.post<DistrictDetails>('/api/districts', payload)
    return data
  },

  /**
   * Подробная карточка района.
   */
  async show(id: number): Promise<DistrictDetails> {
    const { data } = await api.get<DistrictDetails>(`/api/districts/${id}`)
    return data
  },

  /**
   * Править район (владелец).
   */
  async update(id: number, payload: Partial<CreateDistrictPayload>): Promise<DistrictDetails> {
    const { data } = await api.patch<DistrictDetails>(`/api/districts/${id}`, payload)
    return data
  },

  /**
   * Удалить район вместе с чатом (владелец).
   */
  async remove(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/api/districts/${id}`)
    return data
  },

  /**
   * Поставить общую обложку (только владелец, видят все).
   *
   * @param id id района
   * @param file картинка обложки
   */
  async uploadCover(id: number, file: File): Promise<DistrictDetails> {
    const form = new FormData()
    form.append('cover', file)
    const { data } = await api.post<DistrictDetails>(`/api/districts/${id}/cover`, form)
    return data
  },

  /**
   * Убрать общую обложку (только владелец).
   *
   * @param id id района
   */
  async removeCover(id: number): Promise<DistrictDetails> {
    const { data } = await api.delete<DistrictDetails>(`/api/districts/${id}/cover`)
    return data
  },

  /**
   * Жители, заявки и исходящие приглашения района.
   */
  async members(id: number): Promise<{ residents: DistrictResident[]; pending: DistrictResident[]; invited: DistrictResident[]; role: string }> {
    const { data } = await api.get(`/api/districts/${id}/members`)
    return data
  },

  /**
   * Кинуть заявку в район.
   *
   * Организации указывают цель вступления обязательно (минимум 10
   * символов) — бэк вернёт 422 без неё. Персоны — по желанию.
   *
   * @param id id района
   * @param message цель вступления (до 500 символов)
   */
  async join(id: number, message?: string): Promise<{ ok: boolean; status: string; role: string }> {
    const clean = String(message ?? '').trim()
    const { data } = await api.post(`/api/districts/${id}/join`, clean !== '' ? { message: clean.slice(0, 500) } : {})
    return data
  },

  /**
   * Пригласить жителя (владелец): шлёт приглашение, житель входит
   * только после «Принять» в уведомлениях/карточке, вне зоны тоже ок.
   *
   * @param id id района
   * @param userId кого зовём
   */
  async invite(id: number, userId: number): Promise<{ ok: boolean; status: string }> {
    const { data } = await api.post(`/api/districts/${id}/invites`, { user_id: userId })
    return data
  },

  /**
   * Принять приглашение в район (только приглашённый).
   *
   * @param id id района
   */
  async acceptInvite(id: number): Promise<{ ok: boolean; status: string; role: string }> {
    const { data } = await api.post(`/api/districts/${id}/invites/accept`)
    return data
  },

  /**
   * Отклонить приглашение в район (только приглашённый, тихо).
   *
   * @param id id района
   */
  async declineInvite(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.post(`/api/districts/${id}/invites/decline`)
    return data
  },

  /**
   * Отозвать приглашение (только владелец).
   *
   * @param id id района
   * @param userId кого отменяем
   */
  async cancelInvite(id: number, userId: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/api/districts/${id}/invites/${userId}`)
    return data
  },

  /**
   * Выйти из района / отозвать заявку.
   */
  async leave(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/api/districts/${id}/leave`)
    return data
  },

  /**
   * Одобрить заявку (владелец).
   */
  async approve(id: number, userId: number): Promise<{ ok: boolean }> {
    const { data } = await api.post(`/api/districts/${id}/members/${userId}/approve`)
    return data
  },

  /**
   * Отклонить заявку (владелец).
   */
  async reject(id: number, userId: number): Promise<{ ok: boolean }> {
    const { data } = await api.post(`/api/districts/${id}/members/${userId}/reject`)
    return data
  },

  /**
   * Исключить жителя (владелец).
   */
  async kick(id: number, userId: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete(`/api/districts/${id}/members/${userId}`)
    return data
  },
}
