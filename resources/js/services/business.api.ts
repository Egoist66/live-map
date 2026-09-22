import { api } from './api'
import type { AccountType, BusinessDashboard, BusinessMapItem, BusinessPhoto, BusinessProfile, BusinessProfilePayload } from '@/types/entities/Business'
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
}
