import { api } from './api'

export interface ReferenceMeta {
  company_name?: string
  inn?: string
  ogrn?: string
  address?: string
  email?: string
  phone?: string
  version?: string
  effective_date?: string
}

export interface ReferenceAttachment {
  name: string
  path: string
  url: string
  size?: number
  uploaded_at?: string
}

export interface ReferencePage {
  id: number
  slug: string
  title: string
  body?: string | null
  meta?: ReferenceMeta | null
  attachments?: ReferenceAttachment[]
  is_published: boolean
  published_at?: string | null
  updated_at?: string
}

/**
 * Публичное API справочных страниц.
 */
export const referenceApi = {
  async show(slug: string): Promise<ReferencePage> {
    const { data } = await api.get(`/api/reference/${slug}`)
    return data
  },
}

/**
 * Админское API справочных страниц.
 */
export const adminReferenceApi = {
  async list(page = 1) {
    const { data } = await api.get('/api/admin/reference', { params: { page } })
    return data
  },
  async create(payload: Partial<ReferencePage>) {
    const { data } = await api.post('/api/admin/reference', payload)
    return data
  },
  async update(id: number, payload: Partial<ReferencePage>) {
    const { data } = await api.patch(`/api/admin/reference/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await api.delete(`/api/admin/reference/${id}`)
    return data
  },
  async uploadAttachment(id: number, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post(`/api/admin/reference/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
  async removeAttachment(id: number, index: number) {
    const { data } = await api.delete(`/api/admin/reference/${id}/attachments/${index}`)
    return data
  },
}
