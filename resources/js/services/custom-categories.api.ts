import { api } from './api'
import type { CustomCategoryDef } from '@/composables/useCustomCategories'

export const customCategoriesApi = {
  async list(): Promise<CustomCategoryDef[]> {
    const { data } = await api.get<CustomCategoryDef[]>('/api/custom-categories')
    return Array.isArray(data) ? data : []
  },

  async create(payload: { label: string; icon?: string; color?: string }): Promise<CustomCategoryDef> {
    const { data } = await api.post<CustomCategoryDef>('/api/custom-categories', payload)
    return data
  },

  async remove(slug: string): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/api/custom-categories/${slug}`)
    return data
  },
}
