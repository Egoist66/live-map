import { ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { useVideoStore } from '@/stores/videoRoulette'
import { useUserMedia } from '@/composables/useUserMedia'
import { resolveIceServers, usePeerConnection } from '@/composables/usePeerConnection'
import { captureAuthUid, currentAuthUid } from '@/composables/useAuthUid'
import { videoApi } from '@/services/video.api'
import type { VideoPeer } from '@/services/video.api'
import { chatApi } from '@/services/chat.api'
import { busOn } from '@/services/realtime-bus'
import { pokeRealtime } from '@/composables/useRealtimePoller'

/** Heartbeat очереди рулетки: сервер держит место QUEUE_TTL_SEC. */
const ROULETTE_HEARTBEAT_MS = 45000

// Синглтоны модуля: микрофон и peer одни на приложение, иначе два
// компонента (поиск + окно звонка) разорвут друг друга.
let sharedMedia: ReturnType<typeof useUserMedia> | null = null
let sharedPeer: ReturnType<typeof usePeerConnection> | null = null
const sharedRemoteRef = ref<HTMLMediaElement | null>(null)
const sharedBusy = ref(false)
const sharedNotice = ref<string | null>(null)
const overlayOpen = ref(false)
/** Рулетка-режим: пару принимаем автоматически, без диалога «Принять». */
const sharedRouletteAuto = ref(false)
/** Последний собеседник рулетки (для «уйти в приват» после смены пары). */
const sharedLastPeer = ref<VideoPeer | null>(null)
/** Приглашение в приватный чат от собеседника (живёт дольше звонка). */
const sharedPendingInvite = ref<{ conversationId: number; fromName: string } | null>(null)
/** Подписка на инвайты уже висит (одна на приложение). */
let inviteBusBound = false
/** Защита от двойного автоприёма одной и той же пары. */
let autoAccepting = false
let heartbeat: ReturnType<typeof setInterval> | null = null
/** Вотчеры сессии уже зарегистрированы (хук зовут 4+ компонентов — без гарда каждый вешал свой watch и дублировал bind/accept). */
let sessionWatchesBound = false
/** Последний живой узел удалённого звука: чистим shared-реф при размонтировании. */
let lastRemoteNode: HTMLMediaElement | null = null

/**
 * Приглашение в приват: payload {conversation_id} от второго участника.
 */
interface PrivateInviteEvent {
  call_id: number
  kind: string
  payload?: { conversation_id?: number } | null
}

/**
 * Назначить поток элементу и запустить воспроизведение.
 *
 * srcObject трогаем только при смене потока, play() зовём всегда:
 * автоплей-политика может резать play без жеста.
 *
 * @param el медиа-элемент
 * @param stream поток для воспроизведения
 * @param isRemote true для чужого звука (ставим флаг блокировки)
 * @param onBlocked колбэк блокировки автоплея со звуком
 */
async function playVideoEl(
  el: HTMLMediaElement,
  stream: MediaStream,
  isRemote: boolean,
  onBlocked: () => void,
): Promise<void> {
  if (el.srcObject !== stream) {
    el.srcObject = stream
  }
  try {
    await el.play()
  } catch (e) {
    const name = (e as Error)?.name ?? ''
    if (isRemote && name === 'NotAllowedError') {
      onBlocked()
    }
  }
}

/**
 * Голосовая сессия: связывает стор, микрофон и P2P-соединение.
 *
 * Компонент только показывает плитки и кнопки: вся механика
 * (микрофон → звонок → offer/answer → отбой → heartbeat) здесь.
 * Работает в обоих realtime-режимах: сигналинг идёт через шину,
 * куда дублируют и сокет, и polling.
 *
 * @example
 * const v = useVideoSession()
 * v.bindRealtime()
 * await v.callMatch(42)
 * <audio :ref="v.setRemoteEl" autoplay class="hidden" />
 */
export function useVideoSession() {
  captureAuthUid()
  const store = useVideoStore()
  if (!sharedMedia) sharedMedia = useUserMedia()
  if (!sharedPeer) sharedPeer = usePeerConnection()
  const media = sharedMedia
  const peer = sharedPeer

  const remoteRef = sharedRemoteRef
  const busy = sharedBusy
  const notice = sharedNotice
  const rouletteAuto = sharedRouletteAuto
  const lastPeer = sharedLastPeer
  const pendingInvite = sharedPendingInvite
  const rouletteCount = ref<number | null>(null)
  /** Браузер запретил autoplay удалённого звука — ждём тап. */
  const remoteAudioBlocked = ref(false)

  bindSessionWatchesOnce()

  /**
   * Зарегистрировать вотчеры сессии один раз на приложение.
   *
   * Хук дёргают VideoGlobalHost, VideoOverlay, IncomingCallDialog, свайпы и
   * чат — без гарда каждый инстанс вешал свои watch на те же стор-поля:
   * смена звонка запускала 3-5 параллельных peer.bind (гонка PC, утечки
   * подписок шины), а размонтирование любого компонента (уход со свайпов)
   * гасило общий heartbeat очереди через onUnmounted. Heartbeat теперь
   * целиком владеет вотчер статуса: старт на searching, стоп на остальном.
   */
  function bindSessionWatchesOnce(): void {
    if (sessionWatchesBound) return
    sessionWatchesBound = true

    watch(
      () => store.status,
      (next) => {
        if (next === 'searching') startHeartbeat()
        else stopHeartbeat()
        if (next === 'idle') {
          peer.close()
          remoteAudioBlocked.value = false
        }
        if (next === 'searching' || next === 'ringing-out' || next === 'active') {
          overlayOpen.value = true
        } else if (next === 'ringing-in' && !sharedRouletteAuto.value) {
          // Входящий принимает диалог «Принять/Отклонить» — пустой оверлей
          // Пустой оверлей поверх него не открываем (на мобилке перекрывал кнопки).
          overlayOpen.value = false
        }
        if (next === 'ringing-in') void maybeAutoAcceptRoulette()
        if (next === 'active') void ensureCallerOffer()
      },
    )

    watch(
      () => store.call?.id ?? null,
      (callId) => {
        const peerBrief = store.call?.peer ?? null
        if (peerBrief) lastPeer.value = peerBrief
        if (callId != null) void ensurePeerForCall()
      },
    )
  }

  /**
   * Подписаться на входящие звонки (сокет + polling).
   * Заодно вешаем разовую подписку на приглашения в приват.
   */
  function bindRealtime(): void {
    store.bindRealtime()
    bindInviteBus()
  }

  /**
   * Разовая подписка на private_invite (одна на приложение).
   * Инвайт переживает звонок: висит баннером, пока не примут/отклонят.
   */
  function bindInviteBus(): void {
    if (inviteBusBound) return
    inviteBusBound = true
    busOn('user:video.signal', (e) => handlePrivateInvite(e as PrivateInviteEvent))
  }

  /**
   * Разобрать входящее приглашение в приватный чат.
   *
   * @param e событие user:video.signal
   */
  function handlePrivateInvite(e: PrivateInviteEvent): void {
    if (!e || String(e.kind) !== 'private_invite') return
    const conversationId = Number(e.payload?.conversation_id ?? 0)
    if (!conversationId) return
    pendingInvite.value = {
      conversationId,
      fromName: lastPeer.value?.name ?? 'Собеседник',
    }
  }

  /**
    * Принять приглашение в приват: гасим звонок и переходим в чат.
   * Уходят оба — пригласивший уже там, второго ведёт эта кнопка.
   */
  async function acceptPrivateInvite(): Promise<void> {
    const conversationId = pendingInvite.value?.conversationId ?? null
    if (!conversationId || busy.value) return
    busy.value = true
    try {
      await leaveVideoSilently()
      pendingInvite.value = null
      router.visit(`/chat/${conversationId}?from=roulette`)
    } finally {
      busy.value = false
    }
  }

  /**
   * Отклонить приглашение в приват (остаёмся в рулетке).
   */
  function declinePrivateInvite(): void {
    pendingInvite.value = null
  }

  /**
   * Тихо свернуть звонок (очередь/звонок/микрофон) без навигации.
   * Общий знаменатель для «в приват» и принятия чужого инвайта.
   */
  async function leaveVideoSilently(): Promise<void> {
    peer.close()
    media.stop()
    rouletteAuto.value = false
    try {
      const callId = store.call?.id ?? store.incoming?.callId ?? null
      if (callId) await videoApi.hangup(callId)
    } catch {}
    try {
      await videoApi.rouletteLeave()
    } catch {}
    store.resetSession()
    overlayOpen.value = false
  }

  /** Отметить автоплей-блок удалённого звука (покажем кнопку-тап). */
  function markRemoteBlocked(): void {
    remoteAudioBlocked.value = true
  }

  /**
   * Ref-колбэк удалённого <audio>: ontrack мог выстрелить раньше маунта
   * (быстрое соединение) — тогда цепляем уже готовый поток из peer.
   *
   * @param el DOM-узел или null при размонтировании
   */
  function setRemoteEl(el: unknown): void {
    const node = el as HTMLMediaElement | null
    if (!node) {
      if (lastRemoteNode && remoteRef.value === lastRemoteNode) {
        remoteRef.value = null
      }
      lastRemoteNode = null
      return
    }
    lastRemoteNode = node
    remoteRef.value = node
    const ready = peer.remoteStream.value
    if (ready && ready.getTracks().length > 0) {
      void playVideoEl(node, ready, true, markRemoteBlocked)
    }
  }

  /**
   * Прицепить удалённый поток к <audio> и запустить воспроизведение.
   *
   * @param remote поток собеседника
   */
  function attachRemote(remote: MediaStream): void {
    if (remoteRef.value) {
      void playVideoEl(remoteRef.value, remote, true, markRemoteBlocked)
    }
  }

  /**
    * Разблокировать звук собеседника тапом (автоплей-политика).
   * Звать из жеста пользователя (кнопка «Включить звук»).
   */
  async function unlockRemoteAudio(): Promise<void> {
    const node = remoteRef.value
    if (!node) {
      return
    }
    try {
      await node.play()
      remoteAudioBlocked.value = false
    } catch {}
  }

  /**
   * Убедиться что микрофон захвачен (показывает понятную ошибку).
   *
   * Параллельно греем ICE с бэкенда: пока пользователь разрешает
   * доступ, TURN-креды уже в кэше и bind() не ждёт лишний RTT.
   *
   * @returns false когда доступа нет — дальше не идём
   */
  async function ensureMedia(): Promise<boolean> {
    try {
      const mediaPromise = media.start()
      const icePromise = resolveIceServers().catch(() => null)
      await mediaPromise
      await icePromise
      return true
    } catch {
      notice.value = media.error.value
      return false
    }
  }

  /**
   * Позвонить напрямую голосом: мэтчу или другу (допуск проверяет бэк).
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
      await store.callMatch(userId, true)
      const callId = store.call?.id
      if (callId && media.stream.value) {
        await peer.bind(callId, true, media.stream.value, attachRemote)
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
   * Оверлей открываем оптимистично — принявший всегда видит звонок,
   * а не пустоту; при ошибке accept та же модалка покажет её текст.
   */
  async function accept(): Promise<void> {
    if (busy.value) return
    busy.value = true
    notice.value = null
    const incomingMode = store.incoming?.mode ?? store.call?.mode ?? null
    overlayOpen.value = true
    try {
      const ok = await ensureMedia()
      const callId = store.incoming?.callId ?? store.call?.id
      if (!ok || !media.stream.value || !callId) {
        if (!ok) overlayOpen.value = false
        return
      }
      await peer.bind(callId, false, media.stream.value, attachRemote)
      await store.acceptIncoming()
      await ensureCallerOffer()
    } catch {
      // accept упал (звонок протух/завершён): стор уже в idle,
      // поэтому контекст выставляем из запомненного режима —
      // иначе модалка покажет вход в рулетку вместо текста ошибки.
      if (!rouletteAuto.value && incomingMode !== 'roulette') {
        store.entryContext = 'direct'
      }
      overlayOpen.value = true
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
   * Положить трубку и освободить микрофон.
   */
  async function hangup(): Promise<void> {
    const wasRoulette = store.call?.mode === 'roulette' || rouletteAuto.value
    peer.close()
    media.stop()
    if (wasRoulette) rouletteAuto.value = false
    pendingInvite.value = null
    await store.hangup()
    overlayOpen.value = false
  }

  /**
   * Уйти в приват: создать личный чат с собеседником рулетки
    * и перейти туда, звонок завершается.
   * Второму участнику уходит private_invite — он видит баннер
   * «позвали в приват» и переходит той же кнопкой.
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
      const callId = store.call?.id ?? store.incoming?.callId ?? null
      if (callId) {
        try {
          await videoApi.signal(callId, 'private_invite', { conversation_id: convId })
          pokeRealtime()
        } catch {}
      }
      pendingInvite.value = null
      await leaveVideoSilently()
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
   * Встать в очередь голосовой рулетки.
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
      pendingInvite.value = null
      await store.joinRoulette(true)
      await wireRoulettePeer()
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
   * Async: ICE берём с бэкенда до создания RTCPeerConnection.
   */
  async function wireRoulettePeer(): Promise<void> {
    const callId = store.call?.id
    const stream = media.stream.value
    if (!callId || !stream) return
    const caller = !!store.call?.is_caller
    await peer.bind(callId, caller, stream, attachRemote)
  }

  /**
   * Перепривязать peer к текущему звонку, если привязки нет.
   *
   * Чинит главный баг рулетки: ждущий caller узнаёт о паре асинхронно
   * (входящее событие → pullRouletteCall), мимо join/next — peer под
   * звонок никто не поднимал, offer не уходил и оба висели в
   * «соединяется». Вызывается вотчером на смену звонка.
   * Async: bind ждёт ICE с бэкенда, зовём через void из вотчера.
   */
  async function ensurePeerForCall(): Promise<void> {
    const callId = store.call?.id
    const stream = media.stream.value
    if (!callId || !stream) return
    if (peer.currentId() === callId) return
    const caller = !!store.call?.is_caller
    await peer.bind(callId, caller, stream, attachRemote)
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
      await peer.bind(callId, false, media.stream.value, attachRemote)
      await store.acceptIncoming()
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
    if (peer.currentId() !== store.call.id) await ensurePeerForCall()
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
      const ok = media.stream.value ? true : await ensureMedia()
      if (!ok) return
      rouletteAuto.value = true
      pendingInvite.value = null
      await store.nextRoulette()
      await wireRoulettePeer()
      await maybeAutoAcceptRoulette()
    } finally {
      busy.value = false
    }
  }

  /**
   * Выйти из рулетки: очередь + микрофон.
   */
  async function leaveRoulette(): Promise<void> {
    peer.close()
    media.stop()
    rouletteAuto.value = false
    pendingInvite.value = null
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
   * Открыть рулетку из навигации с любой страницы.
   *
   * Лайаут персистентный — оверлей откроется сразу, визит на свайпы
   * догонит следом. Гостей ведём на логин (анонимной рулетки нет).
   * Uid берём из useAuthUid: старый путь через window.__inertia_page
   * всегда давал 0 и гнал залогиненных на /login → /profile.
   */
  function openRouletteFromNav(): void {
    if (!currentAuthUid()) {
      router.visit('/login')
      return
    }
    try {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/swipes')) {
        router.visit('/swipes')
      }
    } catch {}
    openRoulette()
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
   * Переключить микрофон.
   */
  function toggleMute(): void {
    const enabled = media.toggleMute()
    store.muted = !enabled
  }

  /**
   * Heartbeat очереди: пере-join держит место и чистит протухших.
   * Пере-join безопасен: сервер сначала выкидывает себя из очереди.
   */
  function startHeartbeat(): void {
    stopHeartbeat()
    heartbeat = setInterval(() => {
      if (store.status === 'searching') {
        void store.joinRoulette(true)
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
    remoteRef,
    busy,
    notice,
    overlayOpen,
    rouletteAuto,
    lastPeer,
    pendingInvite,
    acceptPrivateInvite,
    declinePrivateInvite,
    rouletteCount,
    loadRouletteCount,
    remoteAudioBlocked,
    unlockRemoteAudio,
    bindRealtime,
    setRemoteEl,
    openRoulette,
    openRouletteFromNav,
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
  }
}

