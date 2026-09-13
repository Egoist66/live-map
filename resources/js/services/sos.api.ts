import { api } from '@/services/api'

/**
 * SOS-вызов: статус, участник, чат.
 */
export interface SosCallState {
  id: number
  status: 'pending' | 'active' | 'closed'
  is_participant: boolean
  is_creator: boolean
  responder: { id: number; name: string; avatar_path: string | null; avatar_url: string | null } | null
  conversation_id: number | null
  pin: any | null
}

/**
 * Лимиты SOS на месяц.
 */
export interface SosLimits {
  used: number
  limit: number
  left: number
  is_pro: boolean
}

/**
 * Активный SOS пользователя и лимиты.
 * @returns вызов (или null) и лимиты месяца
 */
export async function fetchMySos(): Promise<{ sos: SosCallState | null; limits: SosLimits }> {
  const { data } = await api.get('/api/sos/mine')
  return data
}

/**
 * Состояние SOS для пина.
 * @param pinId id SOS-пина
 * @returns вызов, отказ и флаг создателя
 */
export async function fetchPinSos(pinId: number): Promise<{ sos: SosCallState; declined_by_me: boolean; is_creator: boolean }> {
  const { data } = await api.get(`/api/pins/${pinId}/sos`)
  return data
}

/**
 * Принять SOS: стать помогающим, получить отдельный чат.
 * @param pinId id SOS-пина
 * @returns вызов с conversation_id
 */
export async function acceptSos(pinId: number): Promise<{ sos: SosCallState }> {
  const { data } = await api.post(`/api/pins/${pinId}/sos/accept`)
  return data
}

/**
 * Отклонить SOS: вызов больше не предлагается.
 * @param pinId id SOS-пина
 */
export async function declineSos(pinId: number): Promise<{ ok: boolean }> {
  const { data } = await api.post(`/api/pins/${pinId}/sos/decline`)
  return data
}

/**
 * Завершить SOS создателем (пин удаляется, чат остаётся).
 * @param pinId id SOS-пина
 */
export async function closeSos(pinId: number): Promise<{ ok: boolean }> {
  const { data } = await api.post(`/api/pins/${pinId}/sos/close`)
  return data
}
