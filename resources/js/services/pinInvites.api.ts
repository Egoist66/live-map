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
  async mine(): Promise<any[]> {
    const { data } = await api.get('/api/pins/invited/mine')
    return Array.isArray(data) ? data : []
  },
}
