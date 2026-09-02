import { api } from './api'
import type { PinComment, CreateCommentPayload } from '@/types/entities/Comment'
import type { PaginatedResponse } from '@/types/api/pagination'

export const commentsApi = {
  async list(pinId: number): Promise<PinComment[]> {
    const { data } = await api.get<PaginatedResponse<PinComment> | PinComment[]>(`/api/pins/${pinId}/comments`)
    if (Array.isArray(data)) return data
    return (data as PaginatedResponse<PinComment>).data ?? []
  },

  async create(pinId: number, content: string, is_anonymous?: boolean): Promise<PinComment> {
    const { data } = await api.post<PinComment>(`/api/pins/${pinId}/comments`, { content, is_anonymous })
    return data
  },

  async update(id: number, content: string): Promise<PinComment> {
    const { data } = await api.patch<PinComment>(`/api/comments/${id}`, { content })
    return data
  },

  async remove(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/api/comments/${id}`)
    return data
  },
}
