import { api } from './api'
import type { Pin, CreatePinPayload, UpdatePinPayload, BoostType } from '@/types/entities/Pin'
import type { PinBoost } from '@/types/entities/Boost'

export const pinsApi = {
  async list(lat: number, lng: number, radius?: number, signal?: AbortSignal): Promise<Pin[]> {
    const { data } = await api.get<Pin[]>('/api/pins', { params: { lat, lng, radius }, signal } as any)
    return data
  },

  async mine(): Promise<Pin[]> {
    const { data } = await api.get<Pin[] | { data: Pin[] }>('/api/pins/mine')
    if (Array.isArray(data)) return data
    return (data as { data: Pin[] }).data ?? []
  },

  async show(id: number): Promise<Pin> {
    const { data } = await api.get<Pin>(`/api/pins/${id}`)
    return data
  },

  async scheduled(): Promise<Pin[]> {
    const { data } = await api.get<Pin[] | { data: Pin[] }>('/api/pins/mine/scheduled')
    if (Array.isArray(data)) return data
    return (data as { data: Pin[] }).data ?? []
  },

  async archived(): Promise<Pin[]> {
    const { data } = await api.get<Pin[] | { data: Pin[] }>('/api/pins/mine/archived')
    if (Array.isArray(data)) return data
    return (data as { data: Pin[] }).data ?? []
  },

  async create(payload: CreatePinPayload): Promise<Pin> {
    const { data } = await api.post<Pin>('/api/pins', payload)
    return data
  },

  async update(id: number, payload: UpdatePinPayload): Promise<Pin> {
    const { data } = await api.patch<Pin>(`/api/pins/${id}`, payload)
    return data
  },

  async remove(id: number): Promise<{ ok: boolean }> {
    const { data } = await api.delete<{ ok: boolean }>(`/api/pins/${id}`)
    return data
  },

  async boost(id: number, type: BoostType): Promise<PinBoost> {
    const { data } = await api.post<PinBoost>(`/api/pins/${id}/boost`, { type })
    return data
  },
}
