import { onUnmounted, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { useVideoStore } from '@/stores/videoRoulette'
import { useUserMedia } from '@/composables/useUserMedia'
import { usePeerConnection } from '@/composables/usePeerConnection'
import { videoApi } from '@/services/video.api'
import type { VideoPeer } from '@/services/video.api'
import { chatApi } from '@/services/chat.api'

/** Heartbeat очереди рулетки: сервер держит место QUEUE_TTL_SEC. */
const ROULETTE_HEARTBEAT_MS = 45000

// Синглтоны модуля: камера и peer одни на приложение, иначе два
// компонента (превью поиска + окно звонка) разорвут друг друга.
let sharedMedia: ReturnType<typeof useUserMedia> | null = null
let sharedPeer: ReturnType<typeof usePeerConnection> | null = null
const sharedLocalRef = ref<HTMLVideoElement | null>(null)
const sharedRemoteRef = ref<HTMLVideoElement | null>(null)
const sharedBusy = ref(false)
const sharedNotice = ref<string | null>(null)
const overlayOpen = ref(false)
/** Рулетка-режим: пару принимаем автоматически, без диалога «Принять». */
const sharedRouletteAuto = ref(false)
/** Последний собеседник рулетки (для «уйти в приват» после смены пары). */
const sharedLastPeer = ref<VideoPeer | null>(null)
/** Защита от двойного автоприёма одной и той же пары. */
let autoAccepting = false
let heartbeat: ReturnType<typeof setInterval> | null = null

/**
 * Видеосессия: связывает стор, медиа и P2P-соединение.
 *
 * Компонент только показывает <video> и кнопки: вся механика
 * (камера → звонок → offer/answer → отбой → heartbeat) здесь.
 * Работает в обоих realtime-режимах: сигналинг идёт через шину,
 * куда дублируют и сокет, и polling.
 *
 * @example
 * const v = useVideoSession()
 * v.bindRealtime()
 * await v.callMatch(42)
 * <video :ref="v.localRef" autoplay playsinline muted />
 * <video :ref="v.remoteRef" autoplay playsinline />
 */
export function useVideoSession() {
  const store = useVideoStore()
  if (!sharedMedia) sharedMedia = useUserMedia()
  if (!sharedPeer) sharedPeer = usePeerConnection()
  const media = sharedMedia
  const peer = sharedPeer

  const localRef = sharedLocalRef
  const remoteRef = sharedRemoteRef
  const busy = sharedBusy
  const notice = sharedNotice
  const rouletteAuto = sharedRouletteAuto
  const lastPeer = sharedLastPeer
  const rouletteCount = ref<number | null>(null)
  const sharing = ref(false)

  let cameraTrackBackup: MediaStreamTrack | null = null
  let shareTrack: MediaStreamTrack | null = null

  watch(
    () => media.stream.value,
    (next) => {
      if (next && localRef.value) {
        localRef.value.srcObject = next
      }
    },
  )

  watch(
    () => store.status,
    (next) => {
      if (next === 'searching') startHeartbeat()
      else stopHeartbeat()
      if (next === 'idle') peer.close()
      if (store.inCall) overlayOpen.value = true
      if (next === 'ringing-in') void maybeAutoAcceptRoulette()
      if (next === 'active') void ensureCallerOffer()
    },
  )

  watch(
    () => store.call?.id ?? null,
    (callId) => {
      const peerBrief = store.call?.peer ?? null
      if (peerBrief) lastPeer.value = peerBrief
      if (callId != null) ensurePeerForCall()
    },
  )

  onUnmounted(() => {
    stopHeartbeat()
  })

  /**
   * Подписаться на входящие звонки (сокет + polling).
   */
  function bindRealtime(): void {
    store.bindRealtime()
  }

  /**
   * Прицепить локальный поток к <video> (на случай позднего маунта).
   */
  function attachLocal(): void {
    if (media.stream.value && localRef.value) {
      localRef.value.srcObject = media.stream.value
    }
  }

  /**
   * Ref-колбэк локального <video>: элемент пересоздаётся при смене
   * состояния (превью поиска → PiP звонка), поток цепляем сразу.
   *
   * @param el DOM-узел или null при размонтировании
   */
  function setLocalEl(el: unknown): void {
    const node = el as HTMLVideoElement | null
    localRef.value = node
    if (node && media.stream.value) {
      node.srcObject = media.stream.value
    }
  }

  /**
   * Ref-колбэк удалённого <video>: ontrack мог выстрелить раньше маунта
   * (быстрое соединение) — тогда цепляем уже готовый поток из peer.
   *
   * @param el DOM-узел или null при размонтировании
   */
  function setRemoteEl(el: unknown): void {
    const node = el as HTMLVideoElement | null
    remoteRef.value = node
    const ready = peer.remoteStream.value
    if (node && ready && ready.getTracks().length > 0) {
      node.srcObject = ready
    }
  }

  /**
   * Прицепить удалённый поток к <video>.
   *
   * @param remote поток собеседника
   */
  function attachRemote(remote: MediaStream): void {
    if (remoteRef.value) {
      remoteRef.value.srcObject = remote
    }
  }

  /**
   * Убедиться что камера захвачена (показывает понятную ошибку).
   *
   * @returns false когда доступа нет — дальше не идём
   */
  async function ensureMedia(): Promise<boolean> {
    try {
      await media.start()
      attachLocal()
      return true
    } catch {
      notice.value = media.error.value
      return false
    }
  }

  /**
   * Позвонить напрямую: мэтчу или другу (допуск проверяет бэк).
   * Ошибка допуска (посторонний) показывает оверлей с текстом.
   *
   * @param userId id собеседника
   */
  async function callMatch(userId: number): Promise<void> {
    if (busy.value) return
    busy.value = true
    notice.value = null
    try {
      const ok = await ensureMedia()
      if (!ok || !media.stream.value) return
      await store.callMatch(userId)
      const callId = store.call?.id
      if (callId && media.stream.value) {
        peer.bind(callId, true, media.stream.value, attachRemote)
      }
      if (store.error) {
        store.entryContext = 'direct'
        overlayOpen.value = true
      }
    } finally {
      busy.value = false
    }
  }

  /**
   * Принять входящий: peer поднимаем ДО accept, чтобы не потерять offer.
   */
  async function accept(): Promise<void> {
    if (busy.value) return
    busy.value = true
    notice.value = null
    try {
      const ok = await ensureMedia()
      const callId = store.incoming?.callId ?? store.call?.id
      if (!ok || !media.stream.value || !callId) return
      peer.bind(callId, false, media.stream.value, attachRemote)
      await store.acceptIncoming()
      attachLocal()
    } finally {
      busy.value = false
    }
  }

  /**
   * Отклонить входящий.
   */
  async function decline(): Promise<void> {
    peer.close()
    await store.declineIncoming()
  }
  /**
   * Положить трубку и погасить камеру.
   */
  async function hangup(): Promise<void> {
    const wasRoulette = store.call?.mode === 'roulette' || rouletteAuto.value
    peer.close()
    media.stop()
    resetSharing()
    if (wasRoulette) rouletteAuto.value = false
    await store.hangup()
    overlayOpen.value = false
  }

  /**
   * Уйти в приват: создать личный чат с собеседником рулетки
   * и перейти туда, видеозвонок завершается.
   *
   * @returns false когда собеседник неизвестен или чат не создался
   */
  async function createPrivateChat(): Promise<boolean> {
    const peerId = store.call?.peer.id ?? store.incoming?.peer.id ?? lastPeer.value?.id ?? null
    if (!peerId || busy.value) return false
    busy.value = true
    notice.value = null
    try {
      const conv = await chatApi.createConversation(peerId)
      const convId = Number(conv?.id ?? conv?.conversation_id ?? 0)
      if (!convId) {
        notice.value = 'Не удалось создать чат'
        return false
      }
      peer.close()
      media.stop()
      resetSharing()
      rouletteAuto.value = false
      try {
        const callId = store.call?.id ?? store.incoming?.callId ?? null
        if (callId) await videoApi.hangup(callId)
      } catch {}
      store.resetSession()
      overlayOpen.value = false
      router.visit(`/chat/${convId}?from=roulette`)
      return true
    } catch {
      notice.value = 'Не удалось создать чат'
      return false
    } finally {
      busy.value = false
    }
  }
  /**
   * Встать в очередь рулетки (камеру греем заранее для превью).
   * Включает авто-режим: пару принимаем сами, как в чатрулетке.
   */
  async function joinRoulette(): Promise<void> {
    if (busy.value) return
    busy.value = true
    notice.value = null
    try {
      const ok = await ensureMedia()
      if (!ok) return
      rouletteAuto.value = true
      await store.joinRoulette()
      wireRoulettePeer()
      await maybeAutoAcceptRoulette()
    } finally {
      busy.value = false
    }
  }

  /**
   * Поднять peer под найденную пару рулетки.
   *
   * Caller ждёт accepted (offer уйдёт сам), callee ждёт offer.
   * Вызывается после join/next и при смене звонка в active.
   */
  function wireRoulettePeer(): void {
    const callId = store.call?.id
    const stream = media.stream.value
    if (!callId || !stream) return
    const caller = !!store.call?.is_caller
    peer.bind(callId, caller, stream, attachRemote)
  }

  /**
   * Перепривязать peer к текущему звонку, если привязки нет.
   *
   * Чинит главный баг рулетки: ждущий caller узнаёт о паре асинхронно
   * (входящее событие → pullRouletteCall), мимо join/next — peer под
   * звонок никто не поднимал, offer не уходил и оба висели в
   * «соединяется». Вызывается вотчером на смену звонка.
   */
  function ensurePeerForCall(): void {
    const callId = store.call?.id
    const stream = media.stream.value
    if (!callId || !stream) return
    if (peer.currentId() === callId) return
    const caller = !!store.call?.is_caller
    peer.bind(callId, caller, stream, attachRemote)
  }

  /**
   * Автоприём рулеточной пары (чатрулетка-режим, без кнопки «Принять»).
   *
   * Peer поднимаем ДО accept, чтобы не потерять offer caller'а.
   * Для прямых звонков не работает — там принимает человек.
   */
  async function maybeAutoAcceptRoulette(): Promise<void> {
    if (!rouletteAuto.value) return
    if (store.status !== 'ringing-in') return
    if (store.incoming?.mode !== 'roulette') return
    if (autoAccepting) return
    autoAccepting = true
    busy.value = true
    notice.value = null
    try {
      const ok = await ensureMedia()
      const callId = store.incoming?.callId ?? store.call?.id
      if (!ok || !media.stream.value || !callId) return
      peer.bind(callId, false, media.stream.value, attachRemote)
      await store.acceptIncoming()
      attachLocal()
      await ensureCallerOffer()
    } finally {
      busy.value = false
      autoAccepting = false
    }
  }

  /**
   * Добить offer caller'а при переходе в active.
   *
   * Страховка от потерянного accepted-сигнала при живом сокете:
   * startOffer внутри защищён флагом (один offer на звонок),
   * повторный вызов — безопасный no-op.
   */
  async function ensureCallerOffer(): Promise<void> {
    if (store.status !== 'active') return
    if (!store.call?.is_caller) return
    if (peer.currentId() !== store.call.id) ensurePeerForCall()
    if (peer.currentId() == null) return
    await peer.startOffer()
  }

  /**
   * «Дальше»: закрыть peer текущего и искать следующего.
   */
  async function nextRoulette(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      peer.close()
      if (sharing.value) await stopShare()
      const ok = media.stream.value ? true : await ensureMedia()
      if (!ok) return
      rouletteAuto.value = true
      await store.nextRoulette()
      wireRoulettePeer()
      await maybeAutoAcceptRoulette()
    } finally {
      busy.value = false
    }
  }

  /**
   * Выйти из рулетки: очередь + камера.
   */
  async function leaveRoulette(): Promise<void> {
    peer.close()
    media.stop()
    resetSharing()
    rouletteAuto.value = false
    await store.leaveRoulette()
    store.resetSession()
  }

  /**
   * Открыть оверлей рулетки (точка входа из ленты).
   */
  function openRoulette(): void {
    notice.value = null
    store.entryContext = 'roulette'
    overlayOpen.value = true
    void loadRouletteCount()
  }

  /**
   * Подтянуть счётчик очереди для бейджа «сейчас в рулетке».
   */
  async function loadRouletteCount(): Promise<void> {
    try {
      const res = await videoApi.rouletteStats()
      rouletteCount.value = Number(res.waiting ?? 0)
    } catch {}
  }

  /**
   * Закрыть оверлей: из поиска выходим из очереди, звонок не рвём —
   * его завершает только hangup (диалог немодально не закрывается).
   */
  function closeOverlay(): void {
    if (store.status === 'searching') {
      void leaveRoulette()
    }
    if (!store.inCall) overlayOpen.value = false
  }

  /**
   * Переключить камеру фронталка↔тыльная без разрыва соединения.
   * Во время шаринга недоступно.
   */
  async function flipCamera(): Promise<void> {
    if (!media.stream.value || sharing.value || busy.value) return
    busy.value = true
    try {
      const track = await media.switchCamera()
      if (!track) {
        notice.value = 'Вторая камера не найдена'
        return
      }
      const ok = await peer.replaceVideoTrack(track)
      if (!ok) notice.value = 'Не удалось переключить камеру'
      attachLocal()
    } finally {
      busy.value = false
    }
  }

  /**
   * Начать демонстрацию экрана (как в Meet): трек камеры паркуем,
   * шлём экран тем же peer без переподключения. Остановка шаринга
   * системной кнопкой браузера сама вернёт камеру (onended).
   */
  async function shareScreen(): Promise<void> {
    if (sharing.value || !media.stream.value || busy.value) return
    busy.value = true
    notice.value = null
    try {
      const next = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const track = next.getVideoTracks()[0] ?? null
      if (!track || !media.stream.value) {
        try {
          next.getTracks().forEach((t) => t.stop())
        } catch {}
        return
      }
      const current = media.stream.value.getVideoTracks()[0] ?? null
      if (current) {
        try {
          media.stream.value.removeTrack(current)
        } catch {}
      }
      media.stream.value.addTrack(track)
      cameraTrackBackup = current
      shareTrack = track
      const ok = await peer.replaceVideoTrack(track)
      if (!ok) {
        await stopShare()
        notice.value = 'Не удалось начать демонстрацию'
        return
      }
      sharing.value = true
      attachLocal()
      track.onended = () => {
        void stopShare()
      }
    } catch {
      notice.value = 'Не удалось начать демонстрацию экрана'
    } finally {
      busy.value = false
    }
  }

  /**
   * Вернуть камеру после шаринга.
   */
  async function stopShare(): Promise<void> {
    if (!sharing.value) return
    try {
      shareTrack?.stop()
    } catch {}
    shareTrack = null
    const cam = cameraTrackBackup
    cameraTrackBackup = null
    sharing.value = false
    if (cam && media.stream.value) {
      try {
        media.stream.value.getVideoTracks().forEach((t) => {
          try {
            media.stream.value?.removeTrack(t)
          } catch {}
        })
        media.stream.value.addTrack(cam)
        await peer.replaceVideoTrack(cam)
        attachLocal()
      } catch {}
    }
  }

  /**
   * Сбросить состояние шаринга при выходе из звонка.
   * Треки гасит media.stop(), здесь только флаги.
   */
  function resetSharing(): void {
    sharing.value = false
    cameraTrackBackup = null
    shareTrack = null
  }

  /**
   * Переключить микрофон.
   */
  function toggleMute(): void {
    const enabled = media.toggleMute()
    store.muted = !enabled
  }

  /**
   * Переключить камеру.
   */
  function toggleCamera(): void {
    const enabled = media.toggleCamera()
    store.camOff = !enabled
  }

  /**
   * Heartbeat очереди: пере-join держит место и чистит протухших.
   * Пере-join безопасен: сервер сначала выкидывает себя из очереди.
   */
  function startHeartbeat(): void {
    stopHeartbeat()
    heartbeat = setInterval(() => {
      if (store.status === 'searching') {
        void store.joinRoulette()
      }
    }, ROULETTE_HEARTBEAT_MS)
  }

  /** Остановить heartbeat очереди. */
  function stopHeartbeat(): void {
    if (heartbeat) clearInterval(heartbeat)
    heartbeat = null
  }

  return {
    store,
    media,
    peer,
    localRef,
    remoteRef,
    busy,
    notice,
    overlayOpen,
    rouletteAuto,
    lastPeer,
    rouletteCount,
    loadRouletteCount,
    sharing,
    flipCamera,
    shareScreen,
    stopShare,
    bindRealtime,
    attachLocal,
    setLocalEl,
    setRemoteEl,
    openRoulette,
    closeOverlay,
    callMatch,
    accept,
    decline,
    hangup,
    joinRoulette,
    nextRoulette,
    leaveRoulette,
    createPrivateChat,
    toggleMute,
    toggleCamera,
  }
}

