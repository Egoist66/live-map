import { computed, ref } from 'vue'
import { videoApi } from '@/services/video.api'
import { busOn } from '@/services/realtime-bus'
import { pokeRealtime } from '@/composables/useRealtimePoller'

/** Паузы между повторными отправками сигнала (429/сеть). */
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000]

/**
 * Подождать заданное время (бэкофф ретраев).
 *
 * @param ms миллисекунд
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * HTTP-статус ошибки отправки (сеть — 'сеть').
 *
 * @param e ошибка axios
 * @returns статус или текст
 */
function statusOf(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status
  if (!status) {
    return 'сеть'
  }
  return String(status)
}

/**
 * Можно ли повторить отправку (429, 5xx, обрыв сети).
 *
 * @param e ошибка axios
 * @returns true когда повтор имеет смысл
 */
function isRetryable(e: unknown): boolean {
  const status = (e as { response?: { status?: number } })?.response?.status
  if (!status) {
    return true
  }
  return status === 429 || status >= 500
}

/**
 * Запасной ICE-конфиг: STUN всегда + статический TURN из env, если задан.
 * Основной путь — resolveIceServers() с бэкенда (/api/video/ice-servers),
 * где креды временные и не светятся в бандле.
 *
 * @returns список ICE-серверов для RTCPeerConnection
 */
function fallbackIceServers(): RTCIceServer[] {
  const stun: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun.cloudflare.com:3478'] },
  ]
  const urls = (import.meta.env.VITE_TURN_URLS as string | undefined) || ''
  const username = (import.meta.env.VITE_TURN_USERNAME as string | undefined) || ''
  const credential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) || ''
  if (!urls || !username || !credential) {
    return stun
  }
  const parsed = urls.split(',').map((u) => u.trim()).filter(Boolean)
  if (parsed.length === 0) {
    return stun
  }
  return [...stun, { urls: parsed, username, credential }]
}

/** Кэш ICE с бэкенда: креды временные, храним до ttl (минус запас). */
let cachedIce: { servers: RTCIceServer[]; turnConfigured: boolean; fetchedAt: number; ttlMs: number } | null = null
let iceInflight: Promise<{ servers: RTCIceServer[]; turnConfigured: boolean }> | null = null

/**
 * ICE-серверы с бэкенда с кэшем и фолбэком на STUN.
 *
 * Без TURN ~треть звонков за NAT не соединится — для 100% нужен
 * TURN (TURN_URLS/*, TURN_SECRET или CF_TURN_* в env сервера).
 * Фолбэк молча отдаёт STUN, чтобы звонок хотя бы попробовал встать,
 * а оверлей предупредил через turnConfigured=false.
 *
 * @param force true чтобы пропустить кэш (после failed с iceRestart)
 * @returns серверы + флаг наличия TURN
 */
export async function resolveIceServers(
  force = false,
): Promise<{ servers: RTCIceServer[]; turnConfigured: boolean }> {
  const now = Date.now()
  if (!force && cachedIce && now - cachedIce.fetchedAt < cachedIce.ttlMs) {
    return { servers: cachedIce.servers, turnConfigured: cachedIce.turnConfigured }
  }
  if (!force && iceInflight) {
    return iceInflight
  }
  const load = (async () => {
    try {
      const res = await videoApi.iceServers()
      const servers = Array.isArray(res.iceServers) && res.iceServers.length > 0 ? res.iceServers : fallbackIceServers()
      const turnConfigured = !!res.turnConfigured
      const ttlSec = Number(res.ttl) || 3600
      const ttlMs = Math.max(60_000, Math.min(ttlSec * 1000 - 60_000, 23 * 3600 * 1000))
      cachedIce = { servers, turnConfigured, fetchedAt: Date.now(), ttlMs }
      return { servers, turnConfigured }
    } catch {
      const servers = fallbackIceServers()
      cachedIce = { servers, turnConfigured: false, fetchedAt: Date.now(), ttlMs: 60_000 }
      return { servers, turnConfigured: false }
    } finally {
      iceInflight = null
    }
  })()
  iceInflight = load
  return load
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
   * await peer.bind(callId, isCaller, localStream, (remote) => { audioEl.srcObject = remote })
  * // offer/answer/ice прилетят сами, отправка — внутри
  */
export function usePeerConnection() {
  const remoteStream = ref<MediaStream | null>(null)
  const connectionState = ref<RTCPeerConnectionState | 'idle'>('idle')
  const signalingError = ref<string | null>(null)
  /** null — ICE ещё не запрашивали; false — только STUN, часть звонков за NAT не встанет. */
  const iceTurnConfigured = ref<boolean | null>(null)
  /** Счётчики сигналинга для диагностики («Соединение…» показывает их). */
  const signalStats = ref({
    offerSent: 0,
    answerSent: 0,
    iceSent: 0,
    offerRecv: 0,
    answerRecv: 0,
    iceRecv: 0,
    lastError: null as string | null,
  })
  /** Последний провал обработки сигнала (вид/состояние/ошибка) — показываем в оверлее. */
  const signalFailure = ref<{ kind: string; state: string; message: string } | null>(null)
  /** Компактная строка счётчиков для оверлея. */
  const signalLabel = computed(() => {
    const s = signalStats.value
    const sdpUp = s.offerSent + s.answerSent
    const sdpDown = s.offerRecv + s.answerRecv
    return `SDP ↑${sdpUp} ↓${sdpDown} · ICE ↑${s.iceSent} ↓${s.iceRecv}`
  })

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
  /** Сколько раз перепосылали offer без ответа (answer потерялся/429). */
  let offerRetries = 0
  /** Таймер перевода disconnected → failed (сеть может сама отойти). */
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** Сторож неотвеченного offer: answer мог потеряться в мёртвом realtime. */
  let offerWatchdog: ReturnType<typeof setTimeout> | null = null

  /**
   * Создать соединение и подписаться на сигналы звонка.
   *
   * ICE берём с бэкенда (кэш resolveIceServers): там временные TURN-креды.
   * Поэтому async — peer создаём только после ответа, иначе STUN-only
   * соединение за NAT встанет чёрным экраном без звука.
   *
   * @param callId id звонка
   * @param caller true если мы caller (создаём offer после accepted)
    * @param local локальный аудиопоток с микрофона
   * @param onRemote колбэк с удалённым потоком
   */
  async function bind(callId: number, caller: boolean, local: MediaStream, onRemote: (s: MediaStream) => void): Promise<void> {
    close()
    boundCallId = callId
    isCaller = caller
    offerStarted = false
    autoRestarts = 0
    offerRetries = 0
    clearOfferWatchdog()
    pendingIce = []
    seenRemoteIds.clear()
    signalingError.value = null
    signalFailure.value = null
    signalStats.value = {
      offerSent: 0,
      answerSent: 0,
      iceSent: 0,
      offerRecv: 0,
      answerRecv: 0,
      iceRecv: 0,
      lastError: null,
    }

    const ice = await resolveIceServers()
    iceTurnConfigured.value = ice.turnConfigured
    if (boundCallId !== callId) {
      return
    }
    const next = new RTCPeerConnection({ iceServers: ice.servers })
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
        void postSignal('ice', e.candidate.toJSON(), 2)
      }
    }

    next.onconnectionstatechange = () => {
      connectionState.value = next.connectionState
      const state = next.connectionState
      if (state === 'connected') {
        clearDisconnectTimer()
        signalingError.value = null
        signalStats.value.lastError = null
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
    //
    // Мгновенная добивка: offer/accepted мог уйти пока мы ждали ICE
    // с бэкенда (подписки ещё не было) — без неё P2P висел чёрным до
    // тика поллера. Дедуп по id делает повтор безопасным.
    void catchUp()
  }

  /**
   * Подобрать сигналы звонка, ушедшие до подписки на шину.
   *
   * Закрывает окно гонки bind: пока ждали ICE с бэкенда, вторая сторона
   * могла уже принять (accepted) или прислать offer — сокет их принёс
   * в пустоту, а peer без них навсегда чёрный. Тянем всё с нуля через
   * тот же onSignal (дедуп по id отсечёт повторы от сокета/поллера).
   */
  async function catchUp(): Promise<void> {
    const callId = boundCallId
    if (callId == null) return
    try {
      const res = await videoApi.signals(callId, 0)
      const rows = Array.isArray(res.signals) ? res.signals : []
      for (const row of rows) {
        if (boundCallId !== callId || !pc) return
        await onSignal(row)
      }
    } catch {}
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
   * Отправка с ретраями: если сервер вернул 429/5xx — offerStarted
   * сбрасываем, иначе повторный «Обновить» упрётся в no-op и звонок
   * навсегда останется чёрным.
   *
   * @param restart true для iceRestart при ручном переподключении
   */
  async function startOffer(restart = false): Promise<void> {
    if (!pc || offerStarted || boundCallId == null) return
    offerStarted = true
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false, iceRestart: restart })
      await pc.setLocalDescription(offer)
      const sent = await postSignal('offer', { type: offer.type, sdp: offer.sdp }, 4)
      if (!sent) {
        offerStarted = false
        signalingError.value = 'Offer не ушёл — попробуй «Обновить»'
        return
      }
      armOfferWatchdog()
    } catch {
      offerStarted = false
      signalingError.value = 'Не удалось начать звонок'
    }
  }

  /**
   * Сторож неотвеченного offer: в polling-режиме answer идёт 3–5с и может
   * потеряться (429/обрыв) — тогда caller вечно висит в have-local-offer,
   * а callee давно ждёт. Перепосылаем offer с iceRestart, максимум дважды.
   */
  function armOfferWatchdog(): void {
    clearOfferWatchdog()
    offerWatchdog = setTimeout(() => {
      offerWatchdog = null
      void resendUnansweredOffer()
    }, 8000)
  }

  /** Снять сторожа неотвеченного offer. */
  function clearOfferWatchdog(): void {
    if (offerWatchdog) {
      clearTimeout(offerWatchdog)
    }
    offerWatchdog = null
  }

  /**
   * Перепослать offer, на который не пришёл answer.
   * Проверка signalingState отличает «answer потерялся» от «answer в пути».
   */
  async function resendUnansweredOffer(): Promise<void> {
    if (!pc || boundCallId == null || !isCaller) {
      return
    }
    if (pc.signalingState !== 'have-local-offer') {
      return
    }
    if (offerRetries >= 2) {
      signalingError.value = 'Собеседник не отвечает на запрос соединения — попробуй «Обновить»'
      return
    }
    offerRetries += 1
    offerStarted = false
    await startOffer(true)
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
    const isHandshake = kind === 'offer' || kind === 'answer'
    if (isHandshake && sid > 0) {
      // Метку ставим ДО обработки, а не после answer: один и тот же offer
      // прилетает дважды почти одновременно (сокет + опрос добивки), и пока
      // первый ждёт setRemoteDescription, второй проходит гард состояния —
      // конкурентный setRemoteDescription ронял звонок «Сбоем соединения».
      if (seenRemoteIds.has(sid)) {
        return
      }
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
        const sent = await postSignal('answer', { type: answer.type, sdp: answer.sdp }, 4)
        if (!sent) {
          // Answer не ушёл (429/сеть) — снимаем метку, чтобы повторная
          // доставка того же offer его переобработала, а не игнорировала.
          if (sid > 0) {
            seenRemoteIds.delete(sid)
          }
          signalingError.value = 'Answer не ушёл — попроси собеседника нажать «Обновить»'
          return
        }
        signalStats.value.offerRecv += 1
        return
      }
      if (kind === 'answer') {
        if (!isCaller) return
        if (pc.signalingState !== 'have-local-offer') {
          return
        }
        await pc.setRemoteDescription(new RTCSessionDescription(e.payload))
        await flushPendingIce()
        clearOfferWatchdog()
        signalStats.value.answerRecv += 1
        return
      }
      if (kind === 'ice' && e.payload) {
        signalStats.value.iceRecv += 1
        if (!pc.remoteDescription) {
          pendingIce.push(e.payload as RTCIceCandidateInit)
          return
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(e.payload))
        } catch {}
      }
    } catch (err) {
      signalingError.value = 'Сбой соединения — попробуй переподключиться'
      // Провал обработки — снимаем раннюю метку дедупа, чтобы следующая
      // доставка того же фрейма попробовала снова, а не игнорировалась.
      if ((kind === 'offer' || kind === 'answer') && sid > 0) {
        seenRemoteIds.delete(sid)
      }
      const state = String(pc?.signalingState ?? 'none')
      const message = (err as Error)?.message ?? String(err)
      signalFailure.value = { kind, state, message }
      try {
        console.warn('[video] signal failed', {
          kind,
          sid,
          callId: e.call_id,
          signaling: state,
          connection: pc?.connectionState,
          isCaller,
          err: message,
        })
      } catch {}
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
   * Отправить signaling-фрейм через REST с ретраями.
   *
   * Ретраи обязательны: отправка делит минуту с остальным трафиком,
   * единичный 429/обрыв сети не должен навсегда ронять звонок.
   * После отправки пинаем realtime-поллер в burst: в polling-режиме
   * ответ прилетит следующим быстрым тиком (~1с вместо ~2.5с).
   *
   * @param kind offer|answer|ice
   * @param payload SDP или кандидат
   * @param retries сколько раз повторять при 429/5xx/сети
   * @returns true когда сервер принял фрейм
   */
  async function postSignal(kind: 'offer' | 'answer' | 'ice', payload: unknown, retries = 0): Promise<boolean> {
    if (boundCallId == null) {
      return false
    }
    let attempt = 0
    for (;;) {
      try {
        await videoApi.signal(boundCallId, kind, payload as Record<string, unknown>)
        pokeRealtime()
        bumpSent(kind)
        return true
      } catch (e) {
        const retryable = isRetryable(e)
        if (!retryable || attempt >= retries) {
          signalStats.value.lastError = `${kind} не ушёл (${statusOf(e)})`
          return false
        }
        const wait = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
        attempt += 1
        await sleep(wait)
        if (boundCallId == null) {
          return false
        }
      }
    }
  }

  /**
   * Увеличить счётчик отправленных фреймов.
   *
   * @param kind offer|answer|ice
   */
  function bumpSent(kind: 'offer' | 'answer' | 'ice'): void {
    if (kind === 'offer') {
      signalStats.value.offerSent += 1
    } else if (kind === 'answer') {
      signalStats.value.answerSent += 1
    } else {
      signalStats.value.iceSent += 1
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
   * Закрыть соединение и снять подписку.
   */
  function close(): void {
    clearDisconnectTimer()
    clearOfferWatchdog()
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

  return { remoteStream, connectionState, signalingError, signalFailure, signalStats, signalLabel, iceTurnConfigured, bind, startOffer, retry, close, currentId }
}
