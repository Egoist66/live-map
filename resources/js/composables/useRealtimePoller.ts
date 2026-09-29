import { api } from '@/services/api'
import { busEmit, busOn, getPollContext } from '@/services/realtime-bus'

/** Тик живого поллинга: компромисс задержки и нагрузки (24 запроса/мин) */
const FAST_INTERVAL = 2500
/** Тик в burst-режиме после исходящего действия (был 1с — в сумме с остальными поллерами упирался в throttle) */
const BURST_INTERVAL = 1500
/** Сколько держать ускоренный режим после poke */
const BURST_WINDOW = 10000
/** Дебаунс ручного syncNow */
const POKE_DEBOUNCE = 800
/** Пауза между попытками после ошибки: растёт экспоненциально до потолка */
const BASE_BACKOFF = 3000
const MAX_BACKOFF = 30000
/** Не чаще раза в минуту дёргаем сеть по голой активности (клики/клавиши) */
const ACTIVITY_THROTTLE = 60000
/** Потолок кэша увиденных id сообщений */
const SEEN_CAP = 1000

let fastTimer: ReturnType<typeof setTimeout> | null = null
let slowTimer: ReturnType<typeof setTimeout> | null = null
let pokeTimer: ReturnType<typeof setTimeout> | null = null
let fastRunning = false
let slowRunning = false
let ticking = false
let burstUntil = 0
let lastMsgId = 0
let lastVideoSignalId = 0
let lastTime = 0
let consecutiveErrors = 0
let backoffUntil = 0
let lastActivitySync = 0
let modeListenerAttached = false
let trackingAttached = false
let lastBusinessStatus: string | null = null
const seenBusinessPendingIds = new Set<number>()
const emittedKeys = new Set<string>()
const seenMessageIds = new Set<number>()
const seenVideoSignalIds = new Set<number>()

/**
 * Дедуп тостов при нахлёсте окон тиков (событие может прийти дважды).
 * @param key kind:id[:status]
 * @returns true если уже показывали
 */
function alreadyEmitted(key: string): boolean {
  if (emittedKeys.has(key)) return true
  emittedKeys.add(key)
  if (emittedKeys.size > 500) {
    const first = emittedKeys.values().next().value as string | undefined
    if (first !== undefined) emittedKeys.delete(first)
  }
  return false
}
/** Проверка смены режима, пока едем на сокетах */
const SLOW_INTERVAL = 60000

function echo(): any {
  return (window as any).Echo
}

function disconnectSocket(): void {
  try {
    echo()?.disconnect?.()
  } catch {}
}

function connectSocket(): void {
  try {
    echo()?.connect?.()
  } catch {}
}

function clearFast(): void {
  if (fastTimer) clearTimeout(fastTimer)
  fastTimer = null
}

function clearSlow(): void {
  if (slowTimer) clearTimeout(slowTimer)
  slowTimer = null
}

/**
 * Запасной транспорт realtime на период лимита WS-соединений.
 *
 * Быстрый цикл (2.5с, только видимая вкладка) тянет /api/realtime/sync
 * и разносит данные по шине: сообщения, правки, удаления, typing,
 * превью, бейджи. Зеркалит события в user:*-формате сокетов, чтобы
 * существующие подписчики (чат, тосты, бейджи) работали без ветвлений.
 * В режиме socket работает редкий вотчер смены режима (60с).
 * Сокет в polling-режиме рвётся сразу — освобождаем слот Reverb.
 *
 * @example
 * const { ensure, stop } = useRealtimePoller()
 * ensure('polling')
 */
export function useRealtimePoller() {
  /**
   * Один тик быстрого цикла. В burst-окне после исходящего
   * действия тикает чаще, тики не накладываются друг на друга.
   * После ошибок выдерживает экспоненциальный бэкофф, офлайн
   * ждёт события online вместо холостых запросов.
   */
  async function tickFast(): Promise<void> {
    clearFast()
    if (!fastRunning) return
    const now = Date.now()
    const online = typeof navigator === 'undefined' || navigator.onLine !== false
    if (!document.hidden && !ticking && online && now >= backoffUntil) {
      ticking = true
      try {
        await syncOnce()
        noteSuccess()
      } catch (error) {
        noteFailure(error)
      }
      ticking = false
    }
    if (!fastRunning) return
    fastTimer = setTimeout(() => void tickFast(), nextInterval())
  }

  /**
   * Пауза до следующего тика: burst после poke, бэкофф после ошибок.
   *
   * @returns миллисекунд до следующего тика
   */
  function nextInterval(): number {
    const now = Date.now()
    if (now < backoffUntil) return Math.max(backoffUntil - now, 1000)
    if (consecutiveErrors > 0) {
      const backoff = Math.min(BASE_BACKOFF * 2 ** (consecutiveErrors - 1), MAX_BACKOFF)
      return backoff
    }
    return now < burstUntil ? BURST_INTERVAL : FAST_INTERVAL
  }

  /**
   * Успешный тик: сбрасываем счётчик ошибок и бэкофф.
   */
  function noteSuccess(): void {
    consecutiveErrors = 0
    backoffUntil = 0
  }

  /**
   * Неудачный тик: 429 (throttle) — длинная пауза, сеть — ждём online.
   * 401/419 — сеанс мёртв (завершили с другого устройства): дальше
   * тикать гостем бессмысленно, увозим на логин.
   *
   * @param error ошибка запроса
   */
  function noteFailure(error: unknown): void {
    consecutiveErrors += 1
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 401 || status === 419) {
      try {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      } catch {}
      return
    }
    if (status === 429) {
      backoffUntil = Date.now() + 10000
    } else {
      const backoff = Math.min(BASE_BACKOFF * 2 ** (consecutiveErrors - 1), MAX_BACKOFF)
      backoffUntil = Date.now() + backoff
    }
  }

  /**
   * Дедуп сообщений нахлёста окон тиков: сервер отдаёт окно с запасом
   * 10с, одно сообщение может вернуться в нескольких тиках подряд.
   *
   * @param id id сообщения
   * @returns true если уже разносили
   */
  function alreadySeenMessage(id: number): boolean {
    if (seenMessageIds.has(id)) return true
    seenMessageIds.add(id)
    if (seenMessageIds.size > SEEN_CAP) {
      const first = seenMessageIds.values().next().value as number | undefined
      if (first !== undefined) seenMessageIds.delete(first)
    }
    return false
  }

  /**
   * Дедуп signaling-фреймов видео: окно sync отдаёт с запасом,
   * один offer может вернуться в нескольких тиках подряд.
   * Повторный offer/answer обязательно игнорируем — иначе
   * setRemoteDescription уронит живое соединение.
   *
   * @param id id строки video_signals
   * @returns true если уже разносили
   */
  function alreadySeenVideoSignal(id: number): boolean {
    if (seenVideoSignalIds.has(id)) return true
    seenVideoSignalIds.add(id)
    if (seenVideoSignalIds.size > SEEN_CAP) {
      const first = seenVideoSignalIds.values().next().value as number | undefined
      if (first !== undefined) seenVideoSignalIds.delete(first)
    }
    return false
  }

  /**
   * Один тик вотчера режима (дешёвый, 1 запрос в минуту).
   */
  async function tickSlow(): Promise<void> {
    clearSlow()
    if (!slowRunning) return
    try {
      const { data } = await api.get('/api/realtime/mode')
      if (data?.mode === 'polling') {
        busEmit('realtime:mode', 'polling')
        startFast()
      }
    } catch {}
    if (slowRunning) slowTimer = setTimeout(() => void tickSlow(), SLOW_INTERVAL)
  }

  /**
   * Синхронизация с сервером и разноска по шине.
   */
  async function syncOnce(): Promise<void> {
    const ctx = getPollContext()
    const bbox = ctx.mapBbox ?? null
    const knownIds = Array.isArray(ctx.knownPinIds) ? ctx.knownPinIds.filter((id) => Number(id) > 0).slice(0, 500) : []
    try {
      busEmit('badges:request', Date.now())
    } catch {}
    const { data } = await api.get('/api/realtime/sync', {
      params: {
        since: lastTime || undefined,
        after_id: lastMsgId || undefined,
        video_after_id: lastVideoSignalId || undefined,
        watch_threads: ctx.watchThreads || undefined,
        conversation_id: ctx.conversationId || undefined,
        min_lat: bbox?.minLat,
        max_lat: bbox?.maxLat,
        min_lng: bbox?.minLng,
        max_lng: bbox?.maxLng,
        known_ids: knownIds.length ? knownIds.join(',') : undefined,
      },
    })
    if (data?.mode === 'socket') {
      busEmit('realtime:mode', 'socket')
      startSlow()
      connectSocket()
      return
    }
    lastTime = Number(data?.time) || Date.now()
    const messages = Array.isArray(data?.messages) ? data.messages : []
    for (const msg of messages) {
      if (msg?.id == null) continue
      const id = Number(msg.id)
      if (id > lastMsgId) lastMsgId = id
      if (alreadySeenMessage(id)) continue
      busEmit('chat:message', msg)
      busEmit('user:message.sent', { message: msg })
    }
    const updated = Array.isArray(data?.messages_updated) ? data.messages_updated : []
    for (const msg of updated) {
      if (msg?.id == null) continue
      busEmit('user:message.updated', { message: msg })
    }
    const openIds = Array.isArray(data?.open_ids) ? data.open_ids : []
    if (ctx.conversationId && openIds.length) {
      const ids = openIds.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
      busEmit('chat:open-ids', { conversationId: Number(ctx.conversationId), ids })
    }
    if (ctx.conversationId) {
      const userIds = (Array.isArray(data?.typing) ? data.typing : [])
        .map((id: unknown) => Number(id))
        .filter((id: number) => id > 0)
      busEmit('chat:typing', { conversationId: Number(ctx.conversationId), userIds })
    }
    const previews = Array.isArray(data?.previews) ? data.previews : []
    if (previews.length) busEmit('chat:previews', previews)
    const friendships = Array.isArray(data?.friendships) ? data.friendships : []
    friendships.forEach((e: any) => {
      const f = e?.friendship
      if (f?.id == null || alreadyEmitted(`fr:${f.id}:${f.status}`)) return
      busEmit('notify:friendship', e)
      busEmit('user:friendship.updated', e)
    })
    const matches = Array.isArray(data?.matches) ? data.matches : []
    matches.forEach((e: any) => {
      if (e?.match_id == null || alreadyEmitted(`match:${e.match_id}`)) return
      busEmit('notify:match', e)
      busEmit('user:match.created', e)
    })
    const likes = Array.isArray(data?.swipe_likes) ? data.swipe_likes : []
    likes.forEach((e: any) => {
      if (e?.id == null || alreadyEmitted(`sw:${e.id}`)) return
      busEmit('notify:swipe', e)
      busEmit('user:swipe.liked', e)
    })
    const videoIncoming = Array.isArray(data?.video_incoming) ? data.video_incoming : []
    videoIncoming.forEach((e: any) => {
      if (e?.call_id == null || alreadyEmitted(`video:${e.call_id}`)) return
      busEmit('user:video.incoming', e)
    })
    const videoSignals = Array.isArray(data?.video_signals) ? data.video_signals : []
    for (const s of videoSignals) {
      if (s?.id == null) continue
      const sid = Number(s.id)
      if (sid > lastVideoSignalId) lastVideoSignalId = sid
      if (alreadySeenVideoSignal(sid)) continue
      busEmit('user:video.signal', s)
    }
    const threadUpdates = Array.isArray(data?.thread_updates) ? data.thread_updates : []
    for (const t of threadUpdates) {
      if (!t?.kind || t?.id == null) continue
      busEmit('thread:updated', { kind: String(t.kind), id: Number(t.id), lastId: Number(t.last_id ?? 0) })
    }
    const inbox = Array.isArray(data?.notifications) ? data.notifications : []
    inbox.forEach((e: any) => {
      const n = e?.notification
      if (!n?.id || alreadyEmitted(`notif:${n.id}`)) return
      busEmit('user:notification.created', { notification: n })
    })
    const business = (data as any)?.business ?? null
    if (business?.verification_status) {
      const status = String(business.verification_status)
      if (lastBusinessStatus === null) {
        lastBusinessStatus = status
      } else if (status !== lastBusinessStatus) {
        lastBusinessStatus = status
        busEmit('business:status', { business })
        if (status === 'verified') busEmit('user:business.verified', { business })
        else if (status === 'rejected') busEmit('user:business.rejected', { business })
      }
    }
    const pending = (data as any)?.business_pending ?? null
    if (pending && typeof pending.count === 'number') {
      const items = Array.isArray(pending.items) ? pending.items : []
      for (const item of items) {
        const id = Number(item?.id ?? 0)
        if (!id || seenBusinessPendingIds.has(id)) continue
        seenBusinessPendingIds.add(id)
        if (seenBusinessPendingIds.size > 200) {
          const first = seenBusinessPendingIds.values().next().value as number | undefined
          if (first !== undefined) seenBusinessPendingIds.delete(first)
        }
        busEmit('user:business.verification.submitted', { business: item })
      }
      busEmit('business:pending', { count: Number(pending.count), items })
    }
    const receipts = Array.isArray(data?.receipts) ? data.receipts : []
    if (receipts.length) {
      busEmit('chat:receipts', receipts)
      mirrorReceipts(receipts)
    }
    const wallpapers = Array.isArray((data as any)?.wallpapers) ? (data as any).wallpapers : []
    for (const w of wallpapers) {
      if (w?.conversation_id == null || !w?.wallpaper) continue
      busEmit('chat:wallpaper', { conversation_id: Number(w.conversation_id), wallpaper: w.wallpaper })
    }
    if (data?.map) busEmit('map:pins', data.map)
    if (data?.peer && ctx.conversationId) {
      busEmit('chat:peer', { conversationId: Number(ctx.conversationId), peer: data.peer })
    }
    if (data?.badges) busEmit('badges:update', data.badges)
  }

  /**
   * Зеркалит квитанции поллинга в формат сокетов, чтобы слушатели
   * user:message.delivered/read (чат, бейджи) работали без ветвлений.
   *
   * @param receipts квитанции {id, conversation_id, delivered_at, read_at}
   */
  function mirrorReceipts(receipts: any[]): void {
    const deliveredIds: number[] = []
    const readIds: number[] = []
    let deliveredAt: string | null = null
    let readAt: string | null = null
    let conversationId: number | null = null
    for (const receipt of receipts) {
      if (receipt?.id == null) continue
      const id = Number(receipt.id)
      if (receipt.delivered_at) {
        deliveredIds.push(id)
        deliveredAt = receipt.delivered_at
      }
      if (receipt.read_at) {
        readIds.push(id)
        readAt = receipt.read_at
      }
      if (conversationId === null && receipt.conversation_id != null) {
        conversationId = Number(receipt.conversation_id)
      }
    }
    if (deliveredIds.length) {
      busEmit('user:message.delivered', { message_ids: deliveredIds, delivered_at: deliveredAt, conversation_id: conversationId })
    }
    if (readIds.length) {
      busEmit('user:message.read', { message_ids: readIds, read_at: readAt, conversation_id: conversationId })
    }
  }

  function startFast(): void {
    stopSlow()
    ensureTracking()
    if (fastRunning) return
    fastRunning = true
    consecutiveErrors = 0
    backoffUntil = 0
    disconnectSocket()
    if (!lastTime) lastTime = Date.now()
    void tickFast()
  }

  function startSlow(): void {
    stopFast()
    connectSocket()
    if (slowRunning) return
    slowRunning = true
    void tickSlow()
  }

  function stopFast(): void {
    fastRunning = false
    clearFast()
  }

  function stopSlow(): void {
    slowRunning = false
    clearSlow()
  }

  /**
   * Выбрать транспорт под текущий режим.
   *
   * @param currentMode socket|polling
   */
  function ensure(currentMode: string): void {
    if (currentMode === 'polling') startFast()
    else startSlow()
  }

  /**
   * Остановить всё (логаут/смена аккаунта).
   */
  function stop(): void {
    stopFast()
    stopSlow()
    if (pokeTimer) clearTimeout(pokeTimer)
    pokeTimer = null
    ticking = false
    burstUntil = 0
    backoffUntil = 0
    consecutiveErrors = 0
    lastActivitySync = 0
    lastMsgId = 0
    lastVideoSignalId = 0
    lastTime = 0
    lastBusinessStatus = null
    seenBusinessPendingIds.clear()
    emittedKeys.clear()
    seenMessageIds.clear()
    seenVideoSignalIds.clear()
  }

  /**
   * Мгновенный тик вне расписания (не чаще дебаунса снаружи).
   * Ручной вызов (возврат во вкладку, открытие диалога) пробивает
   * бэкофф: пользователь активен — пробуем сразу, как переподключение сокета.
   */
  async function syncNow(): Promise<void> {
    if (!fastRunning || ticking || document.hidden) return
    clearFast()
    ticking = true
    try {
      await syncOnce()
      noteSuccess()
    } catch (error) {
      noteFailure(error)
    }
    ticking = false
    if (fastRunning) fastTimer = setTimeout(() => void tickFast(), nextInterval())
  }

  /**
   * Всплеск отзывчивости после исходящего действия.
   */
  function poke(): void {
    if (!fastRunning) return
    burstUntil = Date.now() + BURST_WINDOW
    void syncNow()
  }

  return { ensure, stop, syncOnce, poke, syncNow }
}

/**
 * Глобальный трекинг активности вкладки: возврат из фона, фокус,
 * восстановление сети — мгновенный синк, как переподключение сокета.
 * Голая активность (клики/клавиши) не дёргает сеть чаще минуты:
 * живой тик и так идёт каждые 2.5с и обновляет last_seen на сервере.
 */
function ensureTracking(): void {
  if (trackingAttached || typeof document === 'undefined') return
  trackingAttached = true

  const onVisible = (): void => {
    if (!document.hidden) {
      try {
        useRealtimePoller().syncNow()
      } catch {}
    }
  }
  const onOnline = (): void => {
    backoffUntil = 0
    consecutiveErrors = 0
    try {
      useRealtimePoller().syncNow()
    } catch {}
  }
  const onActivity = (): void => {
    const now = Date.now()
    if (now - lastActivitySync < ACTIVITY_THROTTLE) return
    lastActivitySync = now
    if (backoffUntil > now) {
      backoffUntil = 0
      consecutiveErrors = 0
      try {
        useRealtimePoller().syncNow()
      } catch {}
    }
  }

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onVisible)
  window.addEventListener('online', onOnline)
  window.addEventListener('pointerdown', onActivity, { passive: true })
  window.addEventListener('keydown', onActivity)
}

/**
 * Ускорение после исходящего действия: мгновенный тик (дебаунс)
 * и частые тики BURST_WINDOW — ответ прилетает почти как по сокету.
 */
export function pokeRealtime(): void {
  if (pokeTimer) clearTimeout(pokeTimer)
  pokeTimer = setTimeout(() => {
    pokeTimer = null
    try {
      useRealtimePoller().poke()
    } catch {}
  }, POKE_DEBOUNCE)
}

/**
 * Мгновенная синхронизация (открыл диалог/страницу — не ждём тик).
 */
export function syncRealtimeNow(): void {
  try {
    useRealtimePoller().syncNow()
  } catch {}
}

/**
 * Остановить поллер снаружи (логаут).
 */
export function stopRealtimePoller(): void {
  try {
    useRealtimePoller().stop()
  } catch {}
}

/**
 * Подписаться на смену режима из шины (вызывает ensure).
 *
 * @param ensureFn ensure из useRealtimePoller
 */
export function watchRealtimeMode(ensureFn: (mode: string) => void): void {
  if (modeListenerAttached) return
  modeListenerAttached = true
  busOn('realtime:mode', (mode) => {
    try {
      ensureFn(String(mode))
    } catch {}
  })
}
