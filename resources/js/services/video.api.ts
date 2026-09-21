import { api } from './api'

/**
 * Короткий профиль собеседника видеозвонка.
 */
export interface VideoPeer {
  id: number
  name: string
  avatar_url: string | null
}

/**
 * Звонок глазами смотрящего (peer — всегда второй участник).
 */
export interface VideoCallPayload {
  id: number
  mode: 'match' | 'roulette' | 'direct'
  status: string
  is_caller: boolean
  created_at: string | null
  peer: VideoPeer
}

/**
 * Событие входящего звонка (сокет + polling несут один формат).
 */
export interface VideoIncomingEvent {
  call_id: number
  mode: 'match' | 'roulette' | 'direct'
  caller: VideoPeer
  callee: VideoPeer
}

/**
 * Signaling-фрейм (сокет + polling несут один формат).
 * kind=chat — сообщение чата звонка, payload {text}.
 */
export interface VideoSignalEvent {
  id: number
  call_id: number
  sender_id: number
  kind: 'offer' | 'answer' | 'ice' | 'accepted' | 'declined' | 'hangup' | 'timeout' | 'joined' | 'chat'
  payload: any
}

/**
 * API видеозвонков: мэтч-звонки и рулетка.
 *
 * SDP/ICE идут через signal(): сервер пишет строку в video_signals
 * (для polling) и шлёт broadcast получателю (для сокета).
 */
export const videoApi = {
  async callMatch(userId: number) {
    const { data } = await api.post('/api/video/match/call', { user_id: userId })
    return data as { call: VideoCallPayload }
  },
  async accept(callId: number) {
    const { data } = await api.post(`/api/video/${callId}/accept`)
    return data as { call: VideoCallPayload }
  },
  async decline(callId: number) {
    const { data } = await api.post(`/api/video/${callId}/decline`)
    return data as { call: VideoCallPayload }
  },
  async hangup(callId: number) {
    const { data } = await api.post(`/api/video/${callId}/hangup`)
    return data as { call: VideoCallPayload }
  },
  async signal(callId: number, kind: 'offer' | 'answer' | 'ice' | 'chat', payload: unknown) {
    const { data } = await api.post(`/api/video/${callId}/signal`, { kind, payload })
    return data as { id: number; call_id: number; kind: string }
  },
  /**
   * Сигналы звонка курсором (добивка при мёртвом realtime).
   */
  async signals(callId: number, afterId = 0) {
    const { data } = await api.get(`/api/video/${callId}/signals`, { params: { after_id: afterId || undefined } })
    return data as { signals: VideoSignalEvent[] }
  },
  async show(callId: number) {
    const { data } = await api.get(`/api/video/${callId}`)
    return data as { call: VideoCallPayload }
  },
  /**
   * Висящие входящие (добивка при мёртвом realtime).
   */
  async pending() {
    const { data } = await api.get('/api/video/pending/incoming')
    return data as { incoming: VideoIncomingEvent[] }
  },
  /**
   * Сколько людей сейчас в очереди рулетки.
   */
  async rouletteStats() {
    const { data } = await api.get('/api/video/roulette/stats')
    return data as { waiting: number }
  },
  async rouletteJoin(gender?: string | null) {
    const { data } = await api.post('/api/video/roulette/join', gender ? { gender } : {})
    return data as { matched: boolean; call: VideoCallPayload | null }
  },
  async rouletteNext(callId?: number | null, gender?: string | null) {
    const { data } = await api.post('/api/video/roulette/next', {
      call_id: callId ?? null,
      gender: gender ?? null,
    })
    return data as { matched: boolean; call: VideoCallPayload | null }
  },
  async rouletteLeave() {
    const { data } = await api.post('/api/video/roulette/leave')
    return data as { ok: boolean }
  },
}
