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
  /**
   * Создать тестового пользователя (только полные админы).
   *
   * @param payload имя, email (логин), пароль + подтверждение, пол
   * @returns {id, name, email} созданного пользователя
   */
  async createTestUser(payload: { name: string; email: string; password: string; password_confirmation: string; gender?: string }) {
    const { data } = await api.post('/api/admin/users', payload)
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
  /**
   * Смена плана/роли пользователя.
   *
   * Для выдачи роли organization персональному аккаунту нужен флаг
   * confirm_personal — иначе бэкенд вернёт 422 с предупреждением.
   */
  async updateUser(userId: number, payload: { plan?: string; role?: string; confirm_personal?: boolean }) {
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
  /**
   * Очередь модерации отзывов ULove.
   *
   * @param status фильтр: pending | approved | rejected | all
   * @param perPage размер страницы
   * @returns {reviews, pending_count, meta}
   */
  async datingReviews(status = 'pending', perPage = 15) {
    const { data } = await api.get('/api/admin/dating-reviews', { params: { status, per_page: perPage } })
    return data
  },
  /**
   * Вердикт по отзыву: одобрить или отклонить.
   *
   * @param id id отзыва
   * @param status approved — публикуем, rejected — отклоняем
   * @returns {review}
   */
  async resolveDatingReview(id: number, status: 'approved' | 'rejected') {
    const { data } = await api.post(`/api/admin/dating-reviews/${id}/resolve`, { status })
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
  async loginAttempts(params: { q?: string; successful?: 'all' | 'failed' | 'success'; per_page?: number; page?: number } = {}) {
    const { data } = await api.get('/api/admin/login-attempts', { params })
    return data
  },
  async markLoginAttemptsSeen() {
    const { data } = await api.post('/api/admin/login-attempts/seen')
    return data
  },
  /**
   * Сбросить заморозку и счётчик фейлов по email.
   *
   * @param email email для разморозки
   * @returns {ok, email, fails_consecutive, is_frozen, is_banned}
   */
  async resetLoginAttempts(email: string) {
    const { data } = await api.post('/api/admin/login-attempts/reset', { email })
    return data
  },
  async banUser(userId: number, reason?: string) {
    const { data } = await api.post(`/api/admin/users/${userId}/ban`, reason ? { reason } : {})
    return data
  },
  async unbanUser(userId: number) {
    const { data } = await api.delete(`/api/admin/users/${userId}/ban`)
    return data
  },
  async accessStatus() {
    const { data } = await api.get('/api/admin/access/status')
    return data
  },
  async requestAccessCode(email: string) {
    const { data } = await api.post('/api/admin/access/code', { email })
    return data
  },
  async verifyAccessCode(email: string, code: string) {
    const { data } = await api.post('/api/admin/access/verify', { email, code })
    return data
  },
  async lockAccess() {
    const { data } = await api.post('/api/admin/access/lock')
    return data
  },
  async maintenance() {
    const { data } = await api.get('/api/admin/maintenance')
    return data
  },
  async updateMaintenance(payload: { enabled: boolean; title: string; message: string }) {
    const { data } = await api.put('/api/admin/maintenance', payload)
    return data
  },
}
