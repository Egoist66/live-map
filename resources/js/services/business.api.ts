import { api } from './api'
import type { AccountType, BusinessDashboard, BusinessMapItem, BusinessProfile, BusinessProfilePayload } from '@/types/entities/Business'
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

  async setAccountType(accountType: AccountType): Promise<{ account_type: AccountType; landing: string }> {
    const { data } = await api.patch<{ account_type: AccountType; landing: string }>('/api/account-type', {
      account_type: accountType,
    })
    return data
  },
}
