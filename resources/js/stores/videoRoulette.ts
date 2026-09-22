import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { videoApi } from '@/services/video.api'
import type { VideoCallPayload } from '@/services/video.api'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel } from '@/composables/useUserChannel'
import { pokeRealtime } from '@/composables/useRealtimePoller'
import { currentAuthUid } from '@/composables/useAuthUid'

/** Статус видеосессии. */
export type VideoStatus = 'idle' | 'searching' | 'ringing-out' | 'ringing-in' | 'active'

let realtimeBound = false
let ringTimer: ReturnType<typeof setTimeout> | null = null

/** Сколько ждём ответа на исходящий до авто-отбоя (вровень с серверным RING_TTL_SEC=40). */
const RING_TIMEOUT_MS = 40000

/**
 * Стор голосовых звонков: мэтч-звонки и рулетка.
 *
 * Бизнес-сущность живёт в pinia (Правило №8): статус сессии, текущий
 * звонок, входящие, lifecycle-сигналы. SDP/ICE фреймы стор не трогает —
 * их разбирает usePeerConnection по тому же bus-событию.
 *
 * Оба транспорта (сокет + polling) приносят одинаковые события
 * user:video.incoming / user:video.signal — ветвлений нет.
 *
 * @example
 * const video = useVideoStore()
 * video.bindRealtime()
 * await video.callMatch(42)
 */
export const useVideoStore = defineStore('video', () => {
  const status = ref<VideoStatus>('idle')
  const call = ref<VideoCallPayload | null>(null)
  const incoming = ref<{ callId: number; mode: string; audioOnly: boolean; peer: { id: number; name: string; avatar_url: string | null } } | null>(null)
  const error = ref<string | null>(null)
  const info = ref<string | null>(null)
  /** Контекст пустого оверлея: roulette — вход в рулетку, direct — ошибка прямого звонка. */
  const entryContext = ref<'roulette' | 'direct' | null>(null)
  /** Режим текущей очереди рулетки: переживает heartbeat и автопоиск после отбоя. */
  const queueAudioOnly = ref(false)
  const muted = ref(false)
  const connectedAt = ref<number | null>(null)

  /** Жива ли сессия (есть звонок на экране). */
  const inCall = computed(() => status.value === 'active' || status.value === 'ringing-out' || status.value === 'ringing-in')

  /** Длительность соединённого звонка, секунд. */
  const elapsedSec = ref(0)
  let elapsedTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Подписаться на realtime звонков (идемпотентно, один раз на приложение).
   * Звать из видеокомпонентов и из глобального слоя уведомлений.
   */
  function bindRealtime(): void {
    if (realtimeBound) return
    realtimeBound = true
    try {
      ensureUserChannel()
    } catch {}
    busOn('user:video.incoming', (e) => handleIncoming(e))
    busOn('user:video.signal', (e) => handleSignal(e))
  }

  /**
   * Разобрать входящий звонок.
   *
   * В поиске рулетки входящий — это найденная пара: подтягиваем звонок
   * и ждём accepted. В остальной занятости — тихо отклоняем через API,
   * чтобы звонящий не висел в ringing до серверного таймаута.
   *
   * @param e событие user:video.incoming (формат шины: mode строкой)
   */
  function handleIncoming(e: { call_id: number; mode: string; audio_only?: boolean; caller: any; callee: any }): void {
    if (!e || e.call_id == null) return
    const callId = Number(e.call_id)
    if (call.value?.id === callId || incoming.value?.callId === callId) return
    if (status.value === 'searching') {
      void pullRouletteCall(Number(e.call_id))
      return
    }
    if (status.value !== 'idle') {
      declineBusy(e.call_id)
      return
    }
    const uid = currentAuthUid()
    const peer = uid > 0 && e.caller?.id === uid ? e.callee : e.caller
    incoming.value = {
      callId: Number(e.call_id),
      mode: String(e.mode || 'match'),
      audioOnly: !!e.audio_only,
      peer: {
        id: Number(peer?.id || 0),
        name: String(peer?.name || 'Собеседник'),
        avatar_url: peer?.avatar_url ?? null,
      },
    }
    status.value = 'ringing-in'
    armRingTimer(Number(e.call_id))
  }

  /**
   * Подтянуть рулеточную пару, пришедшую входящим событием.
   *
   * Первый ожидающий узнаёт о паре только из broadcast/polling,
   * в ответе join у него matched=false — забираем звонок отдельно.
   *
   * @param callId id звонка из входящего события
   */
  async function pullRouletteCall(callId: number): Promise<void> {
    try {
      const res = await videoApi.show(callId)
      if (status.value !== 'searching') return
      onMatched(res.call)
    } catch {}
  }

  /**
   * Тихо отклонить звонок, прилетевший в занятость.
   *
   * @param callId id звонка
   */
  async function declineBusy(callId: number): Promise<void> {
    try {
      await videoApi.decline(callId)
    } catch {}
  }

  /**
   * Разобрать lifecycle-сигнал (SDP/ICE здесь игнорируем — они для usePeerConnection).
   *
   * Рулетка: конец по инициативе пира (был в active) — автоматом ищем
   * нового, как «Дальше». Свой отбой идёт мимо шины (напрямую reset),
   * поэтому сюда попадают только чужие действия.
   *
   * @param e событие user:video.signal (формат шины: kind строкой)
   */
  function handleSignal(e: { call_id: number; kind: string }): void {
    if (!e || e.call_id == null) return
    const activeId = call.value?.id ?? incoming.value?.callId
    if (Number(e.call_id) !== Number(activeId)) return
    const kind = String(e.kind)
    if (kind === 'accepted') {
      markAccepted()
    } else if (kind === 'declined' || kind === 'hangup' || kind === 'timeout') {
      const wasRoulette = call.value?.mode === 'roulette'
      const wasLive = status.value === 'active'
      const peerName = call.value?.peer.name ?? incoming.value?.peer.name ?? 'Собеседник'
      const keepAudio = queueAudioOnly.value
      resetSession()
      if (wasRoulette && wasLive) {
        info.value = `${peerName} отключился — ищем нового…`
        void joinRoulette(keepAudio)
      } else if (kind === 'declined') {
        info.value = `${peerName} отклонил звонок`
      } else if (kind === 'timeout') {
        info.value = `${peerName} не ответил`
      }
    }
  }

  /**
   * Зафиксировать соединение: вторая сторона приняла.
   * Вынесено отдельно — хост добивает тот же переход опросом show()
   * когда accepted-сигнал потерялся в мёртвом realtime.
   */
  function markAccepted(): void {
    clearRingTimer()
    status.value = 'active'
    startElapsed()
  }

  /**
   * Взвести авто-отбой исходящего/входящего по таймауту.
   *
   * @param callId id звонка
   */
  function armRingTimer(callId: number): void {
    clearRingTimer()
    ringTimer = setTimeout(() => {
      if ((status.value === 'ringing-out' || status.value === 'ringing-in') && (call.value?.id ?? incoming.value?.callId) === callId) {
        void hangup()
      }
    }, RING_TIMEOUT_MS)
  }

  /** Снять авто-отбой. */
  function clearRingTimer(): void {
    if (ringTimer) clearTimeout(ringTimer)
    ringTimer = null
  }

  /** Запустить счётчик длительности звонка. */
  function startElapsed(): void {
    stopElapsed()
    connectedAt.value = Date.now()
    elapsedSec.value = 0
    elapsedTimer = setInterval(() => {
      if (connectedAt.value) elapsedSec.value = Math.floor((Date.now() - connectedAt.value) / 1000)
    }, 1000)
  }

  /** Остановить счётчик длительности. */
  function stopElapsed(): void {
    if (elapsedTimer) clearInterval(elapsedTimer)
    elapsedTimer = null
  }

  /**
   * Позвонить напрямую: мэтчу или другу (допуск проверяет бэк).
   *
   * @param userId id собеседника
   */
  async function callMatch(userId: number, audioOnly = false): Promise<void> {
    if (status.value !== 'idle') return
    error.value = null
    info.value = null
    try {
      const res = await videoApi.callMatch(userId, audioOnly)
      call.value = res.call
      status.value = 'ringing-out'
      armRingTimer(res.call.id)
      pokeRealtime()
    } catch (e: unknown) {
      error.value = extractMessage(e, 'Не удалось позвонить')
    }
  }

  /**
   * Принять входящий звонок.
   */
  async function acceptIncoming(): Promise<void> {
    const callId = incoming.value?.callId
    if (!callId || status.value !== 'ringing-in') return
    error.value = null
    info.value = null
    try {
      const res = await videoApi.accept(callId)
      call.value = res.call
      incoming.value = null
      clearRingTimer()
      status.value = 'active'
      startElapsed()
      pokeRealtime()
    } catch (e: unknown) {
      error.value = extractMessage(e, 'Не удалось принять звонок')
      resetSession()
    }
  }

  /**
   * Отклонить входящий звонок.
   */
  async function declineIncoming(): Promise<void> {
    const callId = incoming.value?.callId
    if (!callId) {
      resetSession()
      return
    }
    try {
      await videoApi.decline(callId)
    } catch {}
    resetSession()
  }

  /**
   * Положить трубку / выйти из звонка.
   */
  async function hangup(): Promise<void> {
    const callId = call.value?.id ?? incoming.value?.callId
    if (callId) {
      try {
        await videoApi.hangup(callId)
      } catch {}
    }
    resetSession()
  }

  /**
   * Встать в очередь рулетки (идемпотентно: повторный join из searching
   * обновляет место в очереди — так работает heartbeat).
   */
  async function joinRoulette(audioOnly = false): Promise<void> {
    if (status.value !== 'idle' && status.value !== 'searching') return
    error.value = null
    info.value = null
    queueAudioOnly.value = audioOnly
    status.value = 'searching'
    try {
      const res = await videoApi.rouletteJoin(null, audioOnly)
      if (res.matched && res.call) {
        onMatched(res.call)
      }
      pokeRealtime()
    } catch (e: unknown) {
      error.value = extractMessage(e, 'Не удалось встать в очередь')
      status.value = 'idle'
    }
  }

  /**
   * Пара найдена (ответ join/next или подтяжка по входящему).
   *
   * Caller ждёт accepted и потом создаёт offer, callee видит
   * диалог «Принять» — как в мэтч-звонке, без автоподключения.
   *
   * @param nextCall звонок из ответа API
   */
  function onMatched(nextCall: VideoCallPayload): void {
    call.value = nextCall
    clearRingTimer()
    if (nextCall.is_caller) {
      status.value = 'ringing-out'
    } else {
      incoming.value = { callId: nextCall.id, mode: nextCall.mode, audioOnly: !!nextCall.audio_only, peer: nextCall.peer }
      status.value = 'ringing-in'
    }
    armRingTimer(nextCall.id)
  }

  /**
   * «Дальше»: завершить текущий и искать следующего.
   * Старый звонок чистим локально сразу, чтобы перепривязка peer
   * не путала прошлую пару с новой.
   */
  async function nextRoulette(): Promise<void> {
    const callId = call.value?.id ?? null
    error.value = null
    info.value = null
    clearRingTimer()
    queueAudioOnly.value = !!call.value?.audio_only
    call.value = null
    incoming.value = null
    status.value = 'searching'
    try {
      const res = await videoApi.rouletteNext(callId)
      if (res.matched && res.call) {
        onMatched(res.call)
      }
      pokeRealtime()
    } catch (e: unknown) {
      error.value = extractMessage(e, 'Не удалось найти следующего')
      status.value = 'idle'
    }
  }

  /**
   * Покинуть очередь рулетки.
   */
  async function leaveRoulette(): Promise<void> {
    try {
      await videoApi.rouletteLeave()
    } catch {}
    if (status.value === 'searching') {
      status.value = 'idle'
    }
  }

  /**
   * Принять рулеточную пару (callee рулетки тоже жмёт accept).
   */
  async function acceptRoulette(): Promise<void> {
    await acceptIncoming()
  }

  /**
   * Сбросить сессию в idle (конец, отказ, таймаут).
   */
  function resetSession(): void {
    clearRingTimer()
    stopElapsed()
    queueAudioOnly.value = false
    call.value = null
    incoming.value = null
    connectedAt.value = null
    elapsedSec.value = 0
    muted.value = false
    status.value = 'idle'
  }

  /**
   * Вытащить текст ошибки API.
   *
   * @param e ошибка запроса
   * @param fallback запасной текст
   * @returns текст для тоста
   */
  function extractMessage(e: unknown, fallback: string): string {
    const err = e as { response?: { status?: number; data?: { message?: string; age_gate?: boolean } } }
    if (err.response?.data?.age_gate) return 'Видео с 18 лет — подтверди возраст в анкете свайпов'
    if (err.response?.status === 402) return err.response?.data?.message || 'Нужен PRO'
    if (err.response?.status === 409) return err.response?.data?.message || 'Собеседник занят'
    if (err.response?.status === 403) return err.response?.data?.message || 'Звонок недоступен'
    return err.response?.data?.message || fallback
  }

  return {
    status,
    call,
    incoming,
    error,
    info,
    entryContext,
    muted,
    elapsedSec,
    inCall,
    bindRealtime,
    handleIncoming,
    handleSignal,
    markAccepted,
    callMatch,
    acceptIncoming,
    declineIncoming,
    hangup,
    joinRoulette,
    nextRoulette,
    leaveRoulette,
    acceptRoulette,
    resetSession,
  }
})
