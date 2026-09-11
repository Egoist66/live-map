/**
 * Локальная шина событий realtime.
 *
 * В режиме polling (см. useRealtimePoller) серверных сокетов нет:
 * поллер разносит свежие данные по подписчикам — чат, тосты, бейджи.
 * В режиме socket шина молчит, всё едет через Echo.
 *
 * @example
 * bus.on('chat:message', (msg) => handleIncoming(msg))
 * bus.emit('chat:message', message)
 */
export type RealtimeEventMap = {
  /** Новое сообщение (пейлоад toArrayPayload) */
  'chat:message': any
  /** Активные печатающие в диалоге */
  'chat:typing': { conversationId: number; userIds: number[] }
  /** Изменившиеся превью диалогов для сайдбара */
  'chat:previews': any[]
  /** Сообщение для тоста уведомлений */
  'notify:message': any
  /** Изменение дружбы (формат FriendshipUpdated) */
  'notify:friendship': any
  /** Новый мэтч (формат MatchCreated) */
  'notify:match': any
  /** Новый лайк анкеты (формат SwipeLiked) */
  'notify:swipe': any
  /** Активность пинов (формат PinActivityCreated) */
  'notify:activity': any
  /** Новая жалоба (формат ReportCreated, только админам) */
  'notify:report': any
  /** Свежее состояние собеседника («в сети») */
  'chat:peer': { conversationId: number; peer: any }
  /** Изменения карты из поллинга */
  'map:pins': { upsert: any[]; deleted: number[]; counters: Record<number, { reactions_count: number; comments_count: number }> }
  /** Квитанции доставки/прочтения из поллинга */
  'chat:receipts': any[]
  /** Единый user-канал: сырые события (user:message.sent и т.д.) */
  'user:message.sent': any
  'user:message.updated': any
  'user:message.deleted': any
  'user:message.delivered': any
  'user:message.read': any
  'user:friendship.updated': any
  'user:user.feed.updated': any
  'user:pin.activity': any
  'user:pin.counters': any
  'user:match.created': any
  'user:swipe.liked': any
  'user:report.created': any
  'user:impersonation.started': any
  /** Переподключение сокета: подписчикам стоит освежить данные */
  'user:reconnected': any
  /** Счётчики бейджей одним пакетом */
  'badges:update': Record<string, number>
  /** Смена режима realtime: socket|polling */
  'realtime:mode': string
}

export type PollContext = {
  conversationId: number | null
  mapBbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null
  knownPinIds?: number[]
}

type Handler<T> = (payload: T) => void

const listeners = new Map<string, Set<Handler<any>>>()
const contextProviders = new Map<string, () => Partial<PollContext>>()

/**
 * Подписаться на событие шины.
 *
 * @param event имя события
 * @param handler обработчик
 * @returns функция отписки
 */
export function busOn<K extends keyof RealtimeEventMap>(event: K, handler: Handler<RealtimeEventMap[K]>): () => void {
  let set = listeners.get(event)
  if (!set) {
    set = new Set()
    listeners.set(event, set)
  }
  set.add(handler)
  return () => {
    try {
      listeners.get(event)?.delete(handler)
    } catch {}
  }
}

/**
 * Разослать событие подписчикам.
 *
 * @param event имя события
 * @param payload данные
 */
export function busEmit<K extends keyof RealtimeEventMap>(event: K, payload: RealtimeEventMap[K]): void {
  const set = listeners.get(event)
  if (!set) return
  set.forEach((handler) => {
    try {
      handler(payload)
    } catch {}
  })
}

/**
 * useChat регистрирует провайдер открытого диалога, useMap — bbox карты,
 * чтобы поллер подтягивал typing/свежие id/пины именно для них.
 *
 * @param key chat|map
 * @param provider функция контекста (null — снять регистрацию)
 */
export function registerPollContextProvider(key: string, provider: (() => Partial<PollContext>) | null): void {
  try {
    if (provider) contextProviders.set(key, provider)
    else contextProviders.delete(key)
  } catch {}
}

/**
 * Текущий контекст поллинга (слияние всех провайдеров).
 */
export function getPollContext(): PollContext {
  const merged: PollContext = { conversationId: null }
  try {
    contextProviders.forEach((provider) => {
      const part = provider?.() ?? {}
      if (part.conversationId != null) merged.conversationId = part.conversationId
      if (part.mapBbox !== undefined) merged.mapBbox = part.mapBbox
      if (part.knownPinIds !== undefined) merged.knownPinIds = part.knownPinIds
    })
  } catch {}
  return merged
}
