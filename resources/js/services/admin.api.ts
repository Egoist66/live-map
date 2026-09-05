import { api } from './api'

export const adminApi = {
  searchUsers(q: string) { return api.get('/api/admin/users/search', { params: { q } }).then(r => r.data) },
  setVisibility(userId: number, is_hidden_from_search: boolean) { return api.patch(`/api/admin/users/${userId}/visibility`, { is_hidden_from_search }).then(r => r.data) },
  deleteUser(userId: number) { return api.delete(`/api/admin/users/${userId}`).then(r => r.data) },
}
