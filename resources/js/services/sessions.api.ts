import { api } from './api'

/**
 * Активная web-сессия пользователя (таб «Безопасность» → «Сеансы»).
 */
export interface UserSession {
  id: string
  ip: string | null
  device: string
  platform: string
  browser: string
  /** Человеческая подпись вроде «Chrome · Windows». */
  label: string
  /** true для сеанса, из которого открыт этот список. */
  is_current: boolean
  last_activity_at: string | null
}

export const sessionsApi = {
  /**
   * Список сеансов текущего пользователя, свежие сверху.
   *
   * @returns строки sessions + id текущего сеанса
   */
  async list(): Promise<{ data: UserSession[]; current_id: string }> {
    const { data } = await api.get('/api/sessions')
    return { data: Array.isArray(data?.data) ? data.data : [], current_id: String(data?.current_id ?? '') }
  },

  /**
   * Завершить чужой сеанс.
   *
   * @param id id строки sessions
   */
  async close(id: string) {
    const { data } = await api.delete(`/api/sessions/${id}`)
    return data
  },

  /**
   * Завершить все сеансы кроме текущего.
   */
  async closeOthers() {
    const { data } = await api.delete('/api/sessions')
    return data as { ok: boolean; closed: number }
  },
}

/**
 * Доверенное устройство пользователя (таб «Безопасность» → «Сеансы»).
 */
export interface UserDeviceRow {
  id: number
  label: string
  device: string
  platform: string | null
  browser: string | null
  client: string
  ip: string | null
  country: string | null
  city: string | null
  /** Пользователь подтвердил, что это его устройство. */
  trusted: boolean
  /** Устройство заблокировано навсегда. */
  blocked: boolean
  /** У устройства есть живой web-сеанс. */
  has_session: boolean
  /** Это устройство текущего сеанса. */
  is_current: boolean
  first_seen_at: string | null
  last_seen_at: string | null
}

export const devicesApi = {
  /**
   * Список устройств текущего пользователя, свежие сверху.
   */
  async list(): Promise<UserDeviceRow[]> {
    const { data } = await api.get('/api/devices')
    return Array.isArray(data?.data) ? data.data : []
  },

  /**
   * Подтвердить устройство («это я»).
   *
   * @param id id устройства
   */
  async trust(id: number) {
    const { data } = await api.post(`/api/devices/${id}/trust`)
    return data
  },

  /**
   * Завершить сеанс устройства без блокировки.
   *
   * @param id id устройства
   */
  async terminate(id: number) {
    const { data } = await api.post(`/api/devices/${id}/terminate`)
    return data as { ok: boolean; revoked: boolean }
  },

  /**
   * Заблокировать устройство навсегда + завершить его сеанс.
   *
   * @param id id устройства
   */
  async block(id: number) {
    const { data } = await api.post(`/api/devices/${id}/block`)
    return data as { ok: boolean; revoked: boolean }
  },

  /**
   * Снять вечную блокировку устройства.
   *
   * @param id id устройства
   */
  async unblock(id: number) {
    const { data } = await api.post(`/api/devices/${id}/unblock`)
    return data
  },
}
