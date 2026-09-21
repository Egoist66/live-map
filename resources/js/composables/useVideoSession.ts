import { onUnmounted, ref, watch } from 'vue'
import { useVideoStore } from '@/stores/videoRoulette'
import { useUserMedia } from '@/composables/useUserMedia'
import { usePeerConnection } from '@/composables/usePeerConnection'

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
    peer.close()
    media.stop()
    await store.hangup()
    overlayOpen.value = false
  }
  /**
   * Встать в очередь рулетки (камеру греем заранее для превью).
   */
  async function joinRoulette(): Promise<void> {
    if (busy.value) return
    busy.value = true
    notice.value = null
    try {
      const ok = await ensureMedia()
      if (!ok) return
      await store.joinRoulette()
      wireRoulettePeer()
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
   * «Дальше»: закрыть peer текущего и искать следующего.
   */
  async function nextRoulette(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      peer.close()
      const ok = media.stream.value ? true : await ensureMedia()
      if (!ok) return
      await store.nextRoulette()
      wireRoulettePeer()
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
    toggleMute,
    toggleCamera,
  }
}

