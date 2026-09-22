import { api } from './api'
import type { AccountType, BusinessDashboard, BusinessProfile, BusinessProfilePayload } from '@/types/entities/Business'

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

  async setAccountType(accountType: AccountType): Promise<{ account_type: AccountType; landing: string }> {
    const { data } = await api.patch<{ account_type: AccountType; landing: string }>('/api/account-type', {
      account_type: accountType,
    })
    return data
  },
}
