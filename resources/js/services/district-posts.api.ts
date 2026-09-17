import { api } from './api'
import type { DistrictPost, DistrictPostComment } from '@/types/entities/DistrictPost'

/**
 * API новостей UDistrict: посты владельца, комменты жителей.
 */
export const districtPostsApi = {
  /**
   * Лента новостей района.
   *
   * @param districtId id района
   * @param page страница пагинации
   */
  async list(districtId: number, page = 1): Promise<{ data: DistrictPost[]; last_page: number; current_page: number }> {
    const { data } = await api.get(`/api/districts/${districtId}/posts`, { params: { page } })
    const rows = Array.isArray((data as { data?: unknown })?.data)
      ? (data as { data: DistrictPost[] }).data
      : []
    const lastPage = Number((data as { last_page?: number })?.last_page ?? 1)
    const currentPage = Number((data as { current_page?: number })?.current_page ?? page)
    return { data: rows, last_page: Number.isFinite(lastPage) ? lastPage : 1, current_page: Number.isFinite(currentPage) ? currentPage : page }
  },

  /**
   * Опубликовать новость (только владелец).
   *
   * @param districtId id района
   * @param payload заголовок, текст и картинка
   */
  async create(
    districtId: number,
    payload: { title?: string | null; body: string; image?: File | null },
  ): Promise<DistrictPost> {
    const form = new FormData()
    if (payload.title) {
      form.append('title', payload.title)
    }
    form.append('body', payload.body)
    if (payload.image) {
      form.append('image', payload.image)
    }
    const { data } = await api.post<DistrictPost>(`/api/districts/${districtId}/posts`, form)
    return data
  },

  /**
   * Править новость (только владелец).
   *
   * @param districtId id района
   * @param postId id новости
   * @param payload новые поля
   */
  async update(
    districtId: number,
    postId: number,
    payload: { title?: string | null; body?: string; image?: File | null; removeImage?: boolean },
  ): Promise<DistrictPost> {
    const form = new FormData()
    form.append('_method', 'PATCH')
    if (payload.title !== undefined) {
      form.append('title', payload.title ?? '')
    }
    if (payload.body !== undefined) {
      form.append('body', payload.body)
    }
    if (payload.image) {
      form.append('image', payload.image)
    }
    if (payload.removeImage) {
      form.append('remove_image', '1')
    }
    const { data } = await api.post<DistrictPost>(`/api/districts/${districtId}/posts/${postId}`, form)
    return data
  },

  /**
   * Удалить новость (только владелец).
   *
   * @param districtId id района
   * @param postId id новости
   */
  async remove(districtId: number, postId: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/api/districts/${districtId}/posts/${postId}`)
    return data
  },

  /**
   * Лайк/анлайк новости (только жители).
   *
   * @param districtId id района
   * @param postId id новости
   */
  async toggleLike(districtId: number, postId: number): Promise<{ liked: boolean; likes_count: number }> {
    const { data } = await api.post<{ liked: boolean; likes_count: number }>(
      `/api/districts/${districtId}/posts/${postId}/like`,
    )
    return data
  },
}

export const districtPostCommentsApi = {
  /**
   * Ветки комментариев новости.
   *
   * @param districtId id района
   * @param postId id новости
   * @param page страница
   */
  async list(
    districtId: number,
    postId: number,
    page = 1,
  ): Promise<{ data: DistrictPostComment[]; last_page: number; current_page: number }> {
    const { data } = await api.get(`/api/districts/${districtId}/posts/${postId}/comments`, { params: { page } })
    const rows = Array.isArray((data as { data?: unknown })?.data)
      ? (data as { data: DistrictPostComment[] }).data
      : []
    const lastPage = Number((data as { last_page?: number })?.last_page ?? 1)
    const currentPage = Number((data as { current_page?: number })?.current_page ?? page)
    return { data: rows, last_page: Number.isFinite(lastPage) ? lastPage : 1, current_page: Number.isFinite(currentPage) ? currentPage : page }
  },

  /**
   * Написать комментарий или ответ (только жители).
   *
   * @param districtId id района
   * @param postId id новости
   * @param content текст
   * @param parentId id родителя для ответа
   */
  async create(
    districtId: number,
    postId: number,
    content: string,
    parentId?: number | null,
  ): Promise<DistrictPostComment> {
    const payload: Record<string, unknown> = { content }
    if (parentId) {
      payload.parent_id = parentId
    }
    const { data } = await api.post<DistrictPostComment>(
      `/api/districts/${districtId}/posts/${postId}/comments`,
      payload,
    )
    return data
  },

  /**
   * Править свой комментарий.
   *
   * @param districtId id района
   * @param postId id новости
   * @param commentId id комментария
   * @param content новый текст
   */
  async update(
    districtId: number,
    postId: number,
    commentId: number,
    content: string,
  ): Promise<DistrictPostComment> {
    const { data } = await api.patch<DistrictPostComment>(
      `/api/districts/${districtId}/posts/${postId}/comments/${commentId}`,
      { content },
    )
    return data
  },

  /**
   * Удалить комментарий с ответами.
   *
   * @param districtId id района
   * @param postId id новости
   * @param commentId id комментария
   */
  async remove(districtId: number, postId: number, commentId: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(
      `/api/districts/${districtId}/posts/${postId}/comments/${commentId}`,
    )
    return data
  },
}
