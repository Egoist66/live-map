import { api } from './api'

export const adminApi = {
  async searchUsers(q: string) {
    const { data } = await api.get('/api/admin/users/search', { params: { q } })
    return data
  },
  async setVisibility(userId: number, is_hidden_from_search: boolean) {
    const { data } = await api.patch(`/api/admin/users/${userId}/visibility`, { is_hidden_from_search })
    return data
  },
  async deleteUser(userId: number) {
    const { data } = await api.delete(`/api/admin/users/${userId}`)
    return data
  },
  async impersonate(userId: number, payload: { reason: string; confirmed: boolean }) {
    const { data } = await api.post(`/api/admin/users/${userId}/impersonate`, payload)
    return data
  },
  async stopImpersonation() {
    const { data } = await api.post('/api/admin/impersonation/stop')
    return data
  },
  async updateUser(userId: number, payload: { plan?: string; role?: string }) {
    const { data } = await api.patch(`/api/admin/users/${userId}`, payload)
    return data
  },
  async reports(status = 'pending') {
    const { data } = await api.get('/api/admin/reports', { params: { status } })
    return data
  },
  async resolveReport(id: number, status: 'resolved' | 'dismissed') {
    const { data } = await api.post(`/api/admin/reports/${id}/resolve`, { status })
    return data
  },
  async overview() {
    const { data } = await api.get('/api/admin/monitoring/overview')
    return data
  },
  async chart(days = 14) {
    const { data } = await api.get('/api/admin/monitoring/chart', { params: { days } })
    return data
  },
  async exportExcel(days = 14) {
    const res = await api.get('/api/admin/monitoring/export', { params: { days }, responseType: 'blob' })
    const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(res.headers['content-disposition'] || '')
    const filename = (match?.[1] || `monitoring-${days}d.xlsx`).replace(/['"]/g, '')
    return { blob: res.data as Blob, filename }
  },
  async online(params: { per_page?: number; page?: number; q?: string } = {}) {
    const { data } = await api.get('/api/admin/monitoring/online', { params })
    return data
  },
  async users(params: { q?: string; filter?: string; sort?: string; per_page?: number; page?: number } = {}) {
    const { data } = await api.get('/api/admin/monitoring/users', { params })
    return data
  },
}
