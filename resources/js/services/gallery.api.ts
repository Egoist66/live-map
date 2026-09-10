import { api } from './api'

export interface GalleryPhoto {
  id: number
  user_id: number
  url: string
  caption: string | null
  likes_count: number
  comments_count: number
  liked: boolean
  liked_incognito?: boolean
  can_comment: boolean
  created_at?: string
}

export interface PhotoLiker {
  user_id: number | null
  name: string
  avatar_url: string | null
  is_incognito: boolean
  created_at?: string
}

export interface GalleryIndex {
  photos: GalleryPhoto[]
  limit: number
  count: number
  can_add: boolean
  photo_comments_privacy: string
  can_comment: boolean
}

export const galleryApi = {
  async list(userId: number): Promise<GalleryIndex> {
    const { data } = await api.get<GalleryIndex>(`/api/users/${userId}/photos`)
    return data
  },
  async upload(file: File, caption?: string | null): Promise<GalleryPhoto> {
    const fd = new FormData()
    fd.append('photo', file)
    if (caption) fd.append('caption', caption)
    const { data } = await api.post<GalleryPhoto>('/api/photos', fd)
    return data
  },
  async updateCaption(id: number, caption: string | null): Promise<GalleryPhoto> {
    const { data } = await api.patch<GalleryPhoto>(`/api/photos/${id}`, { caption: caption ?? '' })
    return data
  },
  async replace(id: number, file: File): Promise<GalleryPhoto> {
    const fd = new FormData()
    fd.append('photo', file)
    fd.append('_method', 'PATCH')
    const { data } = await api.post<GalleryPhoto>(`/api/photos/${id}`, fd)
    return data
  },
  async remove(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/api/photos/${id}`)
    return data
  },
  async toggleLike(id: number, incognito = false): Promise<{ liked: boolean; likes_count: number; is_incognito?: boolean }> {
    const { data } = await api.post<{ liked: boolean; likes_count: number; is_incognito?: boolean }>(`/api/photos/${id}/like`, { incognito })
    return data
  },
  async likers(id: number): Promise<{ likers: PhotoLiker[]; total: number; incognito_count: number }> {
    const { data } = await api.get(`/api/photos/${id}/likers`)
    return data as { likers: PhotoLiker[]; total: number; incognito_count: number }
  },
  async updatePrivacy(photo_comments_privacy: string): Promise<{ photo_comments_privacy: string }> {
    const { data } = await api.patch<{ photo_comments_privacy: string }>('/api/user/photo-comments-privacy', { photo_comments_privacy })
    return data
  },
}

export interface GalleryComment {
  id: number
  photo_id: number
  user_id: number
  content: string
  created_at?: string
  user?: { id: number; name: string; avatar_path?: string | null } | null
}

export const galleryCommentsApi = {
  async list(photoId: number): Promise<GalleryComment[]> {
    const { data } = await api.get<{ data: GalleryComment[] } | GalleryComment[]>(`/api/photos/${photoId}/comments`)
    if (Array.isArray(data)) return data
    return (data as { data: GalleryComment[] }).data ?? []
  },
  async create(photoId: number, content: string): Promise<GalleryComment> {
    const { data } = await api.post<GalleryComment>(`/api/photos/${photoId}/comments`, { content })
    return data
  },
  async remove(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/api/photo-comments/${id}`)
    return data
  },
}
