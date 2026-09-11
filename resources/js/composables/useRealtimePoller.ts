import { api } from '@/services/api'
import { busEmit, busOn, getPollContext } from '@/services/realtime-bus'

/** Тик живого поллинга: компромисс задержки и нагрузки */
const FAST_INTERVAL = 3000
/** Проверка смены режима, пока едем на сокетах */
const SLOW_INTERVAL = 60000

let fastTimer: ReturnType<typeof setTimeout> | null = null
let slowTimer: ReturnType<typeof setTimeout> | null = null
let fastRunning = false
let slowRunning = false
let lastMsgId = 0
let lastTime = 0
let modeListenerAttached = false

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
 * Быстрый цикл (4с, только видимая вкладка) тянет /api/realtime/sync
 * и разносит данные по шине: сообщения, typing, превью, бейджи.
 * В режиме socket работает редкий вотчер смены режима (60с).
 * Сокет в polling-режиме рвётся сразу — освобождаем слот Reverb.
 *
 * @example
 * const { ensure, stop } = useRealtimePoller()
 * ensure('polling')
 */
export function useRealtimePoller() {
  /**
   * Один тик быстрого цикла.
   */
  async function tickFast(): Promise<void> {
    clearFast()
    if (!fastRunning) return
    if (!document.hidden) {
      try {
        await syncOnce()
      } catch {}
    }
    if (fastRunning) fastTimer = setTimeout(() => void tickFast(), FAST_INTERVAL)
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
    const { data } = await api.get('/api/realtime/sync', {
      params: {
        since: lastTime || undefined,
        after_id: lastMsgId || undefined,
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
      if (Number(msg.id) > lastMsgId) lastMsgId = Number(msg.id)
      busEmit('chat:message', msg)
      busEmit('notify:message', msg)
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
    friendships.forEach((e: any) => busEmit('notify:friendship', e))
    const matches = Array.isArray(data?.matches) ? data.matches : []
    matches.forEach((e: any) => busEmit('notify:match', e))
    const likes = Array.isArray(data?.swipe_likes) ? data.swipe_likes : []
    likes.forEach((e: any) => busEmit('notify:swipe', e))
    const activities = Array.isArray(data?.activities) ? data.activities : []
    activities.forEach((e: any) => busEmit('notify:activity', e))
    const reports = Array.isArray(data?.reports) ? data.reports : []
    reports.forEach((e: any) => busEmit('notify:report', e))
    const receipts = Array.isArray(data?.receipts) ? data.receipts : []
    if (receipts.length) busEmit('chat:receipts', receipts)
    if (data?.map) busEmit('map:pins', data.map)
    if (data?.peer && ctx.conversationId) {
      busEmit('chat:peer', { conversationId: Number(ctx.conversationId), peer: data.peer })
    }
    if (data?.badges) busEmit('badges:update', data.badges)
  }

  function startFast(): void {
    stopSlow()
    if (fastRunning) return
    fastRunning = true
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
    lastMsgId = 0
    lastTime = 0
  }

  return { ensure, stop, syncOnce }
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
