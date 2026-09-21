import { ref } from 'vue'
import { videoApi } from '@/services/video.api'
import { busOn } from '@/services/realtime-bus'
import { pokeRealtime } from '@/composables/useRealtimePoller'

/**
 * ICE-серверы: свой TURN из env, иначе публичные STUN.
 * Без TURN ~треть звонков за NAT не соединится — для 100% нужен
 * свой coturn (VITE_TURN_URLS/USERNAME/CREDENTIAL в .env).
 *
 * @returns список ICE-серверов для RTCPeerConnection
 */
function iceServers(): RTCIceServer[] {
  const urls = (import.meta.env.VITE_TURN_URLS as string | undefined) || ''
  const username = (import.meta.env.VITE_TURN_USERNAME as string | undefined) || ''
  const credential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || ''
  if (urls && username && credential) {
    const parsed = urls.split(',').map((u) => u.trim()).filter(Boolean)
    return [{ urls: parsed, username, credential }]
  }
  return [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun.cloudflare.com:3478'] },
  ]
}

/**
 * P2P-соединение звонка: offer создаёт всегда caller.
 *
 * Роли фиксированы бэком (caller — первый в паре), поэтому glare
 * невозможен: callee только отвечает. Сигналы шлём через REST
 * (сервер дублирует их в broadcast + таблицу для polling),
 * принимаем через шину user:video.signal в обоих режимах.
 *
 * Защита от дублей (сокет + опрос приносят одно и то же):
 * - offer/answer дедупятся по id строки;
 * - повторный offer в неверном signalingState молча пропускается
 *   (раньше он ронял setRemoteDescription → «Сбой соединения»);
 * - ICE-кандидаты до установки remote description копятся в очереди
 *   (раньше терялись → чёрный экран без звука за NAT).
 *
 * @example
 * const peer = usePeerConnection()
 * peer.bind(callId, isCaller, localStream, (remote) => { videoEl.srcObject = remote })
 * // offer/answer/ice прилетят сами, отправка — внутри
 */
export function usePeerConnection() {
  const remoteStream = ref<MediaStream | null>(null)
  const connectionState = ref<RTCPeerConnectionState | 'idle'>('idle')
  const signalingError = ref<string | null>(null)

  let pc: RTCPeerConnection | null = null
  let boundCallId: number | null = null
  let isCaller = false
  let offBus: (() => void) | null = null
  let offerStarted = false
  /** Id уже разобранных offer/answer: опрос добивки может продублировать сокет. */
  const seenRemoteIds = new Set<number>()
  /** ICE-кандидаты, пришедшие до setRemoteDescription — жмут очередь. */
  let pendingIce: RTCIceCandidateInit[] = []
  /** Сколько авто-рестартов уже сделано на этом соединении. */
  let autoRestarts = 0
  /** Таймер перевода disconnected → failed (сеть может сама отойти). */
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Создать соединение и подписаться на сигналы звонка.
   *
   * @param callId id звонка
   * @param caller true если мы caller (создаём offer после accepted)
   * @param local локальный поток с камеры
   * @param onRemote колбэк с удалённым потоком
   */
  function bind(callId: number, caller: boolean, local: MediaStream, onRemote: (s: MediaStream) => void): void {
    close()
    boundCallId = callId
    isCaller = caller
    offerStarted = false
    autoRestarts = 0
    pendingIce = []
    seenRemoteIds.clear()
    signalingError.value = null

    const next = new RTCPeerConnection({ iceServers: iceServers() })
    pc = next
    connectionState.value = next.connectionState

    const remote = new MediaStream()
    remoteStream.value = remote

    const localTracks = local.getTracks()
    for (const track of localTracks) {
      next.addTrack(track, local)
    }

    next.ontrack = (e) => {
      const incoming = e.track ?? null
      if (incoming) {
        const known = remote.getTrackById(incoming.id)
        if (!known) {
          remote.addTrack(incoming)
        }
      } else {
        const fallbackTracks = e.streams[0]?.getTracks() ?? []
        for (const track of fallbackTracks) {
          const known = remote.getTrackById(track.id)
          if (!known) {
            remote.addTrack(track)
          }
        }
      }
      onRemote(remote)
    }

    next.onicecandidate = (e) => {
      if (e.candidate && boundCallId) {
        void postSignal('ice', e.candidate.toJSON())
      }
    }

    next.onconnectionstatechange = () => {
      connectionState.value = next.connectionState
      const state = next.connectionState
      if (state === 'connected') {
        clearDisconnectTimer()
        signalingError.value = null
        return
      }
      if (state === 'connecting') {
        return
      }
      if (state === 'disconnected') {
        armDisconnectTimer()
        return
      }
      if (state === 'failed') {
        clearDisconnectTimer()
        void handleFailed()
        return
      }
      if (state === 'closed') {
        clearDisconnectTimer()
      }
    }

    offBus = busOn('user:video.signal', (e) => void onSignal(e))

    // Offer шлём только по accepted: callee к этому моменту уже
    // принял и поднял peer, гонки offer-до-accept нет.
  }

  /**
   * Отложенный перевод долгого disconnected в failed-логику.
   * Кратковременные просадки сети (переход между Wi-Fi/LTE) сами
   * возвращаются в connected — не пугаем пользователя раньше времени.
   */
  function armDisconnectTimer(): void {
    clearDisconnectTimer()
    disconnectTimer = setTimeout(() => {
      disconnectTimer = null
      if (pc && pc.connectionState === 'disconnected' && boundCallId != null) {
        void handleFailed()
      }
    }, 8000)
  }

  /** Снять таймер disconnected. */
  function clearDisconnectTimer(): void {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer)
    }
    disconnectTimer = null
  }

  /**
   * Реакция на failed: caller один раз перезапускает ICE сам,
   * callee ждёт новый offer (кнопка «Обновить» — только у caller).
   */
  async function handleFailed(): Promise<void> {
    if (!pc || boundCallId == null) {
      return
    }
    if (isCaller && autoRestarts < 1) {
      autoRestarts += 1
      signalingError.value = null
      offerStarted = false
      await startOffer(true)
      return
    }
    signalingError.value = isCaller
      ? 'Соединение не установилось — попробуй «Обновить»'
      : 'Соединение не установилось — ждём переподключения собеседника'
  }

  /**
   * Caller: создать offer после accepted (или сразу при bind).
   *
   * @param restart true для iceRestart при ручном переподключении
   */
  async function startOffer(restart = false): Promise<void> {
    if (!pc || offerStarted || boundCallId == null) return
    offerStarted = true
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true, iceRestart: restart })
      await pc.setLocalDescription(offer)
      await postSignal('offer', { type: offer.type, sdp: offer.sdp })
    } catch {
      offerStarted = false
      signalingError.value = 'Не удалось начать звонок'
    }
  }

  /**
   * Ручное переподключение caller'а после failed: новый offer с iceRestart.
   * Callee этим путём не чинится — ему только «Дальше»/отбой.
   */
  async function retry(): Promise<void> {
    if (!pc || boundCallId == null || !isCaller) return
    signalingError.value = null
    offerStarted = false
    await startOffer(true)
  }

  /**
   * Перенегоциация после addTrack (шаринг экрана как новый m-line).
   * replaceTrack её не требует, этот путь — только фолбэк.
   *
   * @returns true если offer ушёл
   */
  async function renegotiate(): Promise<boolean> {
    if (!pc || boundCallId == null || !isCaller) {
      return false
    }
    if (pc.signalingState !== 'stable') {
      return false
    }
    offerStarted = false
    await startOffer(false)
    return offerStarted
  }

  /**
   * Разобрать входящий signaling-фрейм своего звонка.
   *
   * Дедуп offer/answer по id: опрос добивки при мёртвом сокете может
   * принести то, что уже пришло по сокету — повторный setRemoteDescription
   * уронил бы соединение, поэтому дубли молча пропускаем.
   * Ролевые гарды: caller игнорирует чужие offer, callee — чужие answer.
   *
   * @param e событие user:video.signal (формат шины)
   */
  async function onSignal(e: { id?: number; call_id: number; kind: string; payload: any }): Promise<void> {
    if (!pc || e.call_id !== boundCallId) return
    const kind = String(e.kind)
    const sid = Number(e.id ?? 0)
    if ((kind === 'offer' || kind === 'answer') && sid > 0) {
      if (seenRemoteIds.has(sid)) return
      seenRemoteIds.add(sid)
    }
    try {
      if (kind === 'accepted' && isCaller) {
        await startOffer()
        return
      }
      if (kind === 'offer') {
        if (isCaller) return
        if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') {
          return
        }
        await pc.setRemoteDescription(new RTCSessionDescription(e.payload))
        await flushPendingIce()
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await postSignal('answer', { type: answer.type, sdp: answer.sdp })
        return
      }
      if (kind === 'answer') {
        if (!isCaller) return
        if (pc.signalingState !== 'have-local-offer') {
          return
        }
        await pc.setRemoteDescription(new RTCSessionDescription(e.payload))
        await flushPendingIce()
        return
      }
      if (kind === 'ice' && e.payload) {
        if (!pc.remoteDescription) {
          pendingIce.push(e.payload as RTCIceCandidateInit)
          return
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(e.payload))
        } catch {}
      }
    } catch {
      signalingError.value = 'Сбой соединения — попробуй переподключиться'
    }
  }

  /**
   * Слить накопленные ICE-кандидаты после установки remote description.
   * Кандидаты, пришедшие раньше offer/answer, иначе терялись навсегда.
   */
  async function flushPendingIce(): Promise<void> {
    if (!pc) {
      return
    }
    const queued = pendingIce
    pendingIce = []
    for (const init of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(init))
      } catch {}
    }
  }

  /**
   * Отправить signaling-фрейм через REST.
   *
   * После отправки пинаем realtime-поллер в burst: в polling-режиме
   * ответ прилетит следующим быстрым тиком (~1с вместо ~2.5с).
   *
   * @param kind offer|answer|ice
   * @param payload SDP или кандидат
   */
  async function postSignal(kind: 'offer' | 'answer' | 'ice', payload: unknown): Promise<void> {
    if (boundCallId == null) return
    try {
      await videoApi.signal(boundCallId, kind, payload as Record<string, unknown>)
      pokeRealtime()
    } catch {}
  }

  /**
   * Подменить исходящий видеотрек наживую (флип камеры, шаринг экрана).
   * Переподключения не нужно: replaceTrack не рвёт peer и не требует
   * нового offer — собеседник просто видит новый кадр.
   *
   * @param track новый видеотрек
   * @returns true если подмена удалась
   */
  async function replaceVideoTrack(track: MediaStreamTrack): Promise<boolean> {
    if (!pc) return false
    try {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) {
        await sender.replaceTrack(track)
      } else {
        pc.addTrack(track)
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Id звонка, к которому привязан peer (для реактивной перепривязки).
   *
   * @returns id звонка или null когда соединения нет
   */
  function currentId(): number | null {
    return boundCallId
  }

  /**
   * Есть ли исходящий видеосендер (нужен ли offer после addTrack).
   *
   * @returns true когда видео уже negotiated и хватит replaceTrack
   */
  function hasVideoSender(): boolean {
    try {
      return !!pc?.getSenders().some((s) => s.track?.kind === 'video')
    } catch {
      return false
    }
  }

  /**
   * Закрыть соединение и снять подписку.
   */
  function close(): void {
    clearDisconnectTimer()
    try {
      offBus?.()
    } catch {}
    offBus = null
    try {
      pc?.close()
    } catch {}
    pc = null
    boundCallId = null
    pendingIce = []
    remoteStream.value = null
    connectionState.value = 'idle'
  }

  return { remoteStream, connectionState, signalingError, bind, startOffer, retry, renegotiate, hasVideoSender, replaceVideoTrack, close, currentId }
}
