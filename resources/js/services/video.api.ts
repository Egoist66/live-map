import { api } from './api'

/**
 * Короткий профиль собеседника звонка.
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
  audio_only: boolean
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
  audio_only: boolean
  caller: VideoPeer
  callee: VideoPeer
}

/**
 * Signaling-фрейм (сокет + polling несут один формат).
 * kind=chat — сообщение чата звонка, payload {text}.
 * kind=private_invite — приглашение в приватный чат, payload {conversation_id}.
 */
export interface VideoSignalEvent {
  id: number
  call_id: number
  sender_id: number
  kind: 'offer' | 'answer' | 'ice' | 'accepted' | 'declined' | 'hangup' | 'timeout' | 'joined' | 'chat' | 'private_invite'
  payload: any
}

/**
 * ICE-конфиг с бэкенда: STUN всегда + TURN когда настроен.
 * turnConfigured=false — часть звонков за NAT не соединится.
 */
export interface IceServersResponse {
  iceServers: RTCIceServer[]
  turnConfigured: boolean
  ttl: number
}

/**
 * API голосовых звонков: мэтч-звонки и рулетка.
 *
 * SDP/ICE идут через signal(): сервер пишет строку в video_signals
 * (для polling) и шлёт broadcast получателю (для сокета).
 */
export const videoApi = {
  /**
   * ICE-серверы для RTCPeerConnection (кэшировать на ttl ответа).
   *
   * @returns список серверов + флаг наличия TURN
   */
  async iceServers() {
    const { data } = await api.get('/api/video/ice-servers')
    return data as IceServersResponse
  },
  async callMatch(userId: number, audioOnly = false) {
    const { data } = await api.post('/api/video/match/call', { user_id: userId, audio_only: audioOnly })
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
  async signal(callId: number, kind: 'offer' | 'answer' | 'ice' | 'chat' | 'private_invite', payload: unknown) {
    const { data } = await api.post(`/api/video/${callId}/signal`, { kind, payload })
    return data as { id: number; call_id: number; kind: string }
  },
  /**
   * ВРЕМЕННО: отправить серверу те байты SDP, что дошли до парсера
   * (сверка с video.sdp_debug по sid). Только при провале парсинга.
   */
  async reportSdp(callId: number, signalId: number, kind: string, sdp: string) {
    try {
      await api.post(`/api/video/${callId}/sdp-report`, { signal_id: signalId, kind, sdp })
    } catch {}
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
  async rouletteJoin(gender?: string | null, audioOnly = false) {
    const { data } = await api.post('/api/video/roulette/join', { ...(gender ? { gender } : {}), audio_only: audioOnly })
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
