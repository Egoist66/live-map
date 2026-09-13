import { api } from './api'

/**
 * API приглашений в пин.
 */
export const pinInvitesApi = {
  async list(pinId: number): Promise<any[]> {
    const { data } = await api.get(`/api/pins/${pinId}/invites`)
    return Array.isArray(data) ? data : []
  },
  async invite(pinId: number, userId: number): Promise<any> {
    const { data } = await api.post(`/api/pins/${pinId}/invites`, { user_id: userId })
    return data
  },
  async revoke(pinId: number, inviteId: number): Promise<void> {
    await api.delete(`/api/pins/${pinId}/invites/${inviteId}`)
  },
  /**
   * Принять приглашение в пин (только приглашённый).
   * @param pinId id пина
   */
  async accept(pinId: number): Promise<any> {
    const { data } = await api.post(`/api/pins/${pinId}/invites/accept`)
    return data
  },
  /**
   * Отклонить приглашение в пин (только приглашённый).
   * @param pinId id пина
   */
  async decline(pinId: number): Promise<void> {
    await api.post(`/api/pins/${pinId}/invites/decline`)
  },
  async mine(): Promise<any[]> {
    const { data } = await api.get('/api/pins/invited/mine')
    return Array.isArray(data) ? data : []
  },
  /**
   * Остаток месячного лимита приглашений.
   * @returns used/limit/remaining/unlimited
   */
  async usage(): Promise<{ used: number; limit: number | null; remaining: number | null; unlimited: boolean }> {
    const { data } = await api.get('/api/pins/invites/usage')
    return data
  },
}
