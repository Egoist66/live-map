import { api } from './api'
import type { AccountType, BusinessAd, BusinessDashboard, BusinessMapItem, BusinessPhoto, BusinessProfile, BusinessProfilePayload } from '@/types/entities/Business'
import type { Pin } from '@/types/entities/Pin'

export const businessApi = {
  async getProfile(): Promise<BusinessProfile> {
    const { data } = await api.get<{ data: BusinessProfile } | BusinessProfile>('/api/business')
    return (data as { data: BusinessProfile }).data ?? (data as BusinessProfile)
  },

  async updateProfile(payload: BusinessProfilePayload): Promise<BusinessProfile> {
    const { data } = await api.patch<{ data: BusinessProfile } | BusinessProfile>('/api/business', payload)
    return (data as { data: BusinessProfile }).data ?? (data as BusinessProfile)
  },

  async getDashboard(): Promise<BusinessDashboard> {
    const { data } = await api.get<BusinessDashboard>('/api/business/dashboard')
    return data
  },

  async submitForVerification(): Promise<BusinessProfile> {
    const { data } = await api.post<{ data: BusinessProfile } | BusinessProfile>('/api/business/submit')
    return (data as { data: BusinessProfile }).data ?? (data as BusinessProfile)
  },

  async mapBusinesses(lat: number, lng: number, radius?: number): Promise<BusinessMapItem[]> {
    const { data } = await api.get<BusinessMapItem[]>('/api/businesses/map', { params: { lat, lng, radius } })
    return Array.isArray(data) ? data : []
  },

  /**
   * Поиск организаций по названию и бренду (таб «Организации»).
   * @param q запрос минимум 2 символа
   */
  async searchOrganizations(q: string): Promise<BusinessMapItem[]> {
    const { data } = await api.get<BusinessMapItem[]>(`/api/businesses/search`, { params: { q } })
    return Array.isArray(data) ? data : []
  },

  async companyPins(id: number): Promise<Pin[]> {
    const { data } = await api.get<Pin[] | { data: Pin[] }>(`/api/businesses/${id}/pins`)
    if (Array.isArray(data)) return data
    return (data as { data: Pin[] }).data ?? []
  },

  async listPhotos(id: number): Promise<BusinessPhoto[]> {
    const { data } = await api.get<{ photos: BusinessPhoto[] }>(`/api/businesses/${id}/photos`)
    return data?.photos ?? []
  },

  async photosByOwner(userId: number): Promise<BusinessPhoto[]> {
    const { data } = await api.get<{ photos: BusinessPhoto[] }>(`/api/business-photos/by-owner/${userId}`)
    return data?.photos ?? []
  },

  async uploadPhoto(id: number, file: File, caption?: string | null): Promise<BusinessPhoto> {
    const form = new FormData()
    form.append('photo', file)
    if (caption) {
      form.append('caption', caption)
    }
    const { data } = await api.post<BusinessPhoto>(`/api/businesses/${id}/photos`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    } as never)
    return data
  },

  async deletePhoto(businessId: number, photoId: number): Promise<void> {
    await api.delete(`/api/businesses/${businessId}/photos/${photoId}`)
  },

  async uploadLogo(id: number, file: File): Promise<BusinessProfile> {
    const form = new FormData()
    form.append('logo', file)
    const { data } = await api.post<{ data: BusinessProfile } | BusinessProfile>(`/api/businesses/${id}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    } as never)
    return (data as { data: BusinessProfile }).data ?? (data as BusinessProfile)
  },

  async uploadCover(id: number, file: File): Promise<BusinessProfile> {
    const form = new FormData()
    form.append('cover', file)
    const { data } = await api.post<{ data: BusinessProfile } | BusinessProfile>(`/api/businesses/${id}/cover`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    } as never)
    return (data as { data: BusinessProfile }).data ?? (data as BusinessProfile)
  },

  async setAccountType(accountType: AccountType): Promise<{ account_type: AccountType; landing: string }> {
    const { data } = await api.patch<{ account_type: AccountType; landing: string }>('/api/account-type', {
      account_type: accountType,
    })
    return data
  },

  /**
   * Очередь заявок для модерации (staff: админы + модераторы).
   * @param status фильтр статуса (по умолчанию pending)
   * @param q поиск по названию/УНП/email
   * @param page страница
   */
  async adminQueue(status = 'pending', q = '', page = 1): Promise<{ data: BusinessProfile[]; total: number; pending_count: number; current_page: number; last_page: number }> {
    const { data } = await api.get('/api/admin/businesses', { params: { status, q: q || undefined, page } })
    return data
  },

  /**
   * Реклама компании для витрины (видят все).
   * @param businessId id компании
   */
  async listAds(businessId: number): Promise<BusinessAd[]> {
    const { data } = await api.get<BusinessAd[]>(`/api/businesses/${businessId}/ads`)
    return Array.isArray(data) ? data : []
  },

  /**
   * Остаток недельного лимита рекламы (3 в неделю).
   */
  async adsQuota(): Promise<{ used: number; limit: number; left: number }> {
    const { data } = await api.get('/api/business/ads/quota')
    return { used: Number(data?.used ?? 0), limit: Number(data?.limit ?? 3), left: Number(data?.left ?? 0) }
  },

  /**
   * Остаток недельных размещений в районах (3 в неделю).
   */
  async districtQuota(): Promise<{ used: number; limit: number; left: number }> {
    const { data } = await api.get('/api/business/ads/district-quota')
    return { used: Number(data?.used ?? 0), limit: Number(data?.limit ?? 3), left: Number(data?.left ?? 0) }
  },

  /**
   * Разместить рекламу в районах организации.
   * @param adId id рекламы кабинета
   * @param districtIds районы-жители организации
   */
  async placeAdInDistricts(adId: number, districtIds: number[]): Promise<{ placed: number[]; skipped: Array<{ district_id: number; reason: string }>; quota: { used: number; limit: number; left: number } }> {
    const { data } = await api.post(`/api/business-ads/${adId}/districts`, { district_ids: districtIds })
    return data
  },

  /**
   * Опубликовать рекламу (только проверенный бизнес).
   * @param businessId id компании
   * @param payload заголовок + текст
   */
  async createAd(businessId: number, payload: { title: string; body: string }): Promise<BusinessAd> {
    const { data } = await api.post<BusinessAd>(`/api/businesses/${businessId}/ads`, payload)
    return data
  },

  /**
   * Удалить рекламу (слот недели не возвращается).
   * @param adId id рекламы
   */
  async deleteAd(adId: number): Promise<void> {
    await api.delete(`/api/business-ads/${adId}`)
  },

  /**
   * Одобрить заявку (staff).
   * @param id id бизнеса
   */
  async adminVerify(id: number): Promise<BusinessProfile> {
    const { data } = await api.post<{ data: BusinessProfile } | BusinessProfile>(`/api/admin/business/${id}/verify`)
    return (data as { data: BusinessProfile }).data ?? (data as BusinessProfile)
  },

  /**
   * Отклонить заявку с причиной (staff).
   * @param id id бизнеса
   * @param reason причина отказа
   */
  async adminReject(id: number, reason: string): Promise<BusinessProfile> {
    const { data } = await api.post<{ data: BusinessProfile } | BusinessProfile>(`/api/admin/business/${id}/reject`, { reason })
    return (data as { data: BusinessProfile }).data ?? (data as BusinessProfile)
  },
}
