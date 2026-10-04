import { api } from './api'

export const appUpdatesApi = {
  async list() {
    const { data } = await api.get('/api/updates')
    return data
  },
  async unread() {
    const { data } = await api.get('/api/updates/unread')
    return data
  },
  async markRead(id: number) {
    const { data } = await api.post(`/api/updates/${id}/read`)
    return data
  },
  async markAllRead() {
    const { data } = await api.post('/api/updates/read-all')
    return data
  },
}

export const adminUpdatesApi = {
  async list(page = 1) {
    const { data } = await api.get('/api/admin/updates', { params: { page } })
    return data
  },
  async create(payload: { title: string; body: string; version?: string; is_published?: boolean; send_telegram?: boolean }) {
    const { data } = await api.post('/api/admin/updates', payload)
    return data
  },
  async update(id: number, payload: { title?: string; body?: string; version?: string; is_published?: boolean; send_telegram?: boolean }) {
    const { data } = await api.patch(`/api/admin/updates/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await api.delete(`/api/admin/updates/${id}`)
    return data
  },
}
