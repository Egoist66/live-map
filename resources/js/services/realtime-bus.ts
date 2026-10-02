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
  'map:pins': { upsert: any[]; deleted: number[]; counters: Record<number, { reactions_count: number; comments_count: number }>; districts_upsert?: any[]; districts_deleted?: number[] }
  /** Район изменился (сокет map-канала): обновить слой и открытую карточку */
  'map:district-changed': { id: number }
  /** Район удалён (сокет map-канала): убрать слой и закрыть карточку */
  'map:district-deleted': { id: number }
  /** Квитанции доставки/прочтения из поллинга */
  'chat:receipts': any[]
  /** Хвост id открытого диалога: клиент вычищает локально удалённые */
  'chat:open-ids': { conversationId: number; ids: number[] }
  /** Локальное прочтение диалога: страница чата или мини-окно уже пометили read — остальным спискам (док, колокольчик) обнулить счётчик без запросов */
  'chat:dialog-read': number
  /** Общий фон беседы сменился (сокет conversation.wallpaper / поллинг wallpapers) */
  'chat:wallpaper': { conversation_id: number; wallpaper: unknown }
  /** Сеансы пользователя отозваны: сторожить текущий и вылететь при его смерти */
  'user:session.revoked': { session_ids: string[] }
  /** Единый user-канал: сырые события (user:message.sent и т.д.) */
  'user:message.sent': any
  'user:message.updated': any
  'user:message.deleted': any
  'user:message.delivered': any
  'user:message.read': any
  'user:friendship.updated': any
  'user:pin.counters': any
  'user:match.created': any
  'user:swipe.liked': any
  'user:report.created': any
  'user:impersonation.started': any
  'user:business.verified': { business: any }
  'user:business.rejected': { business: any }
  'user:business.verification.submitted': { business: any }
  /** Реактивный статус проверки бизнеса владельца (polling + socket) */
  'business:status': { business: any }
  /** Очередь заявок для staff: счётчик + свежие pending (polling) */
  'business:pending': { count: number; items: any[] }
  /** Единое inbox-уведомление (таблица notifications): тосты и колокольчик */
  'user:notification.created': { notification: any }
  /** Входящий звонок (сокет VideoIncoming / поллинг freshIncoming) */
  'user:video.incoming': { call_id: number; mode: string; caller: any; callee: any }
  /** Signaling-фрейм звонка (сокет VideoSignalEvent / поллинг freshSignals) */
  'user:video.signal': { id: number; call_id: number; sender_id: number; kind: string; payload: any }
  /** Переподключение сокета: подписчикам стоит освежить данные */
  'user:reconnected': any
  /** Счётчики бейджей одним пакетом */
  'badges:update': Record<string, number>
  /** Поллер ушёл в сеть: метка времени запроса для отсева протухших ответов */
  'badges:request': number
  /** Новые новости для очереди апдейтов */
  'notify:update': { updates: any[] }
  /** Тред комментариев изменился (сокет + polling несут один формат) */
  'thread:updated': { kind: string; id: number; lastId: number }
  /** Заметки «Избранного» изменились на другом устройстве (сокет saved-notes.changed) */
  'user:saved-notes.changed': { action: string }
  /** Смена режима realtime: socket|polling */
  'realtime:mode': string
}

export type PollContext = {
  conversationId: number | null
  mapBbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number } | null
  knownPinIds?: number[]
  /** Открытые треды "вид:id:последний_известный_id" для добивки комментариев. */
  watchThreads?: string | null
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
      if (part.watchThreads !== undefined) merged.watchThreads = part.watchThreads
    })
  } catch {}
  return merged
}
