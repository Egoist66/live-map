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
   * Жители и заявки района.
   */
  async members(id: number): Promise<{ residents: DistrictResident[]; pending: DistrictResident[]; role: string }> {
    const { data } = await api.get(`/api/districts/${id}/members`)
    return data
  },

  /**
   * Кинуть заявку в район.
   */
  async join(id: number): Promise<{ ok: boolean; status: string; role: string }> {
    const { data } = await api.post(`/api/districts/${id}/join`)
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
