import { busEmit } from '@/services/realtime-bus'

/**
 * Канонические события user-канала (совпадают с broadcastAs на бэке).
 * Безымянные варианты ('PinCreated' и т.п.) никогда не прилетают —
 * broadcastAs всегда переопределяет имя, поэтому слушаем только dotted.
 */
const USER_EVENTS = [
  'message.sent',
  'message.updated',
  'message.deleted',
  'message.delivered',
  'message.read',
  'friendship.updated',
  'user.feed.updated',
  'pin.activity',
  'pin.counters',
  'match.created',
  'swipe.liked',
  'report.created',
  'impersonation.started',
] as const

let channel: any = null
let channelUid: number | null = null
let reconnectBound = false

function getEcho(): any {
  return (window as any).Echo
}

function getUid(): number {
  try {
    const inertiaUid = Number((window as any)?.__inertia_page?.props?.auth?.user?.id || 0)
    if (inertiaUid) return inertiaUid
  } catch {}
  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
  } catch {}
  return Number((window as any).userId || 0)
}

function bindReconnectOnce(): void {
  if (reconnectBound) return
  try {
    const pusher = getEcho()?.connector?.pusher
    if (!pusher) return
    reconnectBound = true
    pusher.connection.bind('connected', () => {
      try {
        busEmit('user:reconnected', { uid: channelUid })
      } catch {}
    })
  } catch {}
}

/**
 * Единый private(user.*) на вкладку: один auth-запрос вместо семи,
 * события раздаются подписчикам через шину (user:message.sent и т.д.).
 * Переключение аккаунта разруливается само: новый uid — новый канал.
 *
 * @example
 * ensureUserChannel()
 * busOn('user:message.sent', (e) => handleMessage(e))
 */
export function ensureUserChannel(): void {
  try {
    const echo = getEcho()
    if (!echo) return
    const uid = getUid()
    if (!uid) return
    if (channel && channelUid === uid) return
    if (channel) leaveUserChannel()
    channelUid = uid
    channel = echo.private(`user.${uid}`)
    USER_EVENTS.forEach((name) => {
      try {
        channel.listen(`.${name}`, (payload: any) => {
          try {
            busEmit(`user:${name}` as any, payload)
          } catch {}
        })
      } catch {}
    })
    bindReconnectOnce()
  } catch {}
}

/**
 * Покинуть общий user-канал (смена аккаунта, логаут).
 */
export function leaveUserChannel(): void {
  try {
    const echo = getEcho()
    if (echo && channelUid) echo.leave(`user.${channelUid}`)
  } catch {}
  channel = null
  channelUid = null
}
