import { ref, onMounted, onBeforeUnmount } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { avatarSrcFor } from '@/composables/useAvatar'
import { showLocal } from '@/pwa/push.service'
import { useScreenLock } from '@/composables/useScreenLock'

function isLockedNow(): boolean {
  try { return useScreenLock().locked.value } catch { return false }
}

export type AppToast = {
  id: string
  type: 'message' | 'friend' | 'pin' | 'report' | 'security' | 'match'
  title: string
  body: string
  avatar: string | null
  link: string
  createdAt: number
}

const toasts = ref<AppToast[]>([])
let inited = false
let echoCh: any = null
let subscribedUid: number | null = null
let adminMode = false
let seenMsgIds = new Set<number>()
let timers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Сбросить уведомления при смене аккаунта: покинуть user.* и очистить тосты.
 */
export function resetAppNotifications(): void {
  try {
    const echo = getEcho()
    if (echo && subscribedUid) try { echo.leave(`user.${subscribedUid}`) } catch {}
  } catch {}
  echoCh = null
  subscribedUid = null
  inited = false
  seenMsgIds = new Set<number>()
  timers.forEach((t) => clearTimeout(t))
  timers = new Map()
  toasts.value = []
}

function getUid(): number {
  try {
    const inertiaUid = Number((usePage().props.auth as any)?.user?.id || 0)
    if (inertiaUid) return inertiaUid
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
    return Number((window as any).userId || 0)
  } catch { return Number((window as any).userId || 0) }
}
function getEcho(): any { return (window as any).Echo }
function isChatRoute() { try { return (route as any)().current('chat') } catch { return window.location.pathname.startsWith('/chat') } }
function currentConversationId(): number | null {
  try {
    const p = (usePage().props as any)
    if (p.conversationId) return Number(p.conversationId)
  } catch {}
  const m = window.location.pathname.match(/\/chat\/(\d+)/)
  return m ? Number(m[1]) : null
}
function playTick() {
  try {
    const ctx = (window as any)._audioCtx as AudioContext | undefined
    let ac: AudioContext
    if (!ctx) { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); (window as any)._audioCtx = ac } else ac = ctx
    const o = ac.createOscillator(); const g = ac.createGain()
    o.frequency.value = 880; o.type = 'sine'; g.gain.value = 0.08
    o.connect(g).connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.22); o.stop(ac.currentTime + 0.23)
  } catch {}
}
function push(t: AppToast) {
  if (isLockedNow()) return
  toasts.value = [t, ...toasts.value].slice(0, 3)
  playTick()
  const timer = setTimeout(() => remove(t.id), 5500)
  timers.set(t.id, timer)
  if ('vibrate' in navigator) try { (navigator as any).vibrate(120) } catch {}
  try {
    if (typeof document !== 'undefined' && document.hidden) showLocal(t.title, { body: t.body, url: t.link, avatar: t.avatar })
  } catch {}
}
function remove(id: string) {
  toasts.value = toasts.value.filter(x => x.id !== id)
  const tm = timers.get(id); if (tm) { clearTimeout(tm); timers.delete(id) }
}
function handleMessage(e: any) {
  const msg = e?.message
  if (!msg || !msg.id) return
  if (seenMsgIds.has(msg.id)) return
  seenMsgIds.add(msg.id)
  if (seenMsgIds.size > 200) { const first = seenMsgIds.values().next().value as number | undefined; if (first !== undefined) seenMsgIds.delete(first) }
  const uid = getUid()
  if (Number(msg.sender_id) === uid) return
  if (isChatRoute() && Number(msg.conversation_id) === currentConversationId()) return
  const sender = msg.sender || {}
  const name = sender.name || 'Кто-то'
  const body = (msg.body || '').slice(0, 90)
  push({
    id: `msg-${msg.id}-${Date.now()}`,
    type: 'message',
    title: name,
    body: body || 'Новое сообщение',
    avatar: avatarSrcFor(sender),
    link: `/chat/${msg.conversation_id}`,
    createdAt: Date.now(),
  })
}
function handleFriendship(e: any) {
  const f = e?.friendship
  if (!f) return
  const uid = getUid()
  if (f.status === 'pending' && Number(f.addressee_id) === uid) {
    const r = f.requester || {}
    push({
      id: `fr-${f.id}-${Date.now()}`,
      type: 'friend',
      title: 'Заявка в друзья',
      body: `${r.name || 'Кто-то'} хочет дружить`,
      avatar: avatarSrcFor(r),
      link: '/chat?tab=requests',
      createdAt: Date.now(),
    })
  } else if (f.status === 'accepted' && Number(f.requester_id) === uid) {
    const a = f.addressee || {}
    push({
      id: `fr-acc-${f.id}-${Date.now()}`,
      type: 'friend',
      title: 'Заявка принята',
      body: `${a.name || 'Пользователь'} принял заявку`,
      avatar: avatarSrcFor(a),
      link: '/chat?tab=friends',
      createdAt: Date.now(),
    })
  }
}
/**
 * Глубокая ссылка на место активности: комментарий пина, комментарий фото или профиль автора.
 * Повторяет логику resolveTarget/usePinActivity и WebPushService на бэке.
 */
function activityLink(a: any): string {
  const pinId = Number(a?.pin?.id || a?.pin_id || 0) || null
  const commentId = Number(a?.comment_id || 0) || null
  const photoId = Number(a?.photo?.id || a?.photo_id || 0) || null
  const photoCommentId = Number(a?.photo_comment_id || 0) || null
  const actorId = Number(a?.actor?.id || a?.actor_id || 0) || null
  const photoUserId = Number(a?.photo?.user_id || actorId || 0) || null
  if (pinId) {
    return `/map?pin=${pinId}${commentId ? `&comment=${commentId}` : ''}`
  }
  if (photoId && photoUserId) {
    return `/users/${photoUserId}?photo=${photoId}${photoCommentId ? `&comment=${photoCommentId}` : ''}`
  }
  if (actorId) {
    return `/users/${actorId}`
  }
  return '/map'
}
function handlePinActivity(e: any) {
  const a = e?.activity
  if (!a?.id) return
  const uid = getUid()
  if (a.owner_id && uid && Number(a.owner_id) !== uid) return
  const actor = a.actor || {}
  const name = actor.name || 'Кто-то'
  const actorLink = `/users/${actor.id || a.actor_id || ''}`
  if (a.kind === 'sub_pin') {
    const title = (a.excerpt || a.pin?.title || 'новый пин').toString().slice(0, 60)
    push({
      id: `pin-sub-${a.id}-${Date.now()}`,
      type: 'pin',
      title: `${name} создал пин`,
      body: `«${title}»`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: activityLink(a),
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'sub_photo') {
    push({
      id: `pin-sub-photo-${a.id}-${Date.now()}`,
      type: 'pin',
      title: `${name} — новое фото`,
      body: 'Загружено новое фото. Откройте галерею'.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: activityLink(a),
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'sub_level') {
    push({
      id: `pin-sub-level-${a.id}-${Date.now()}`,
      type: 'friend',
      title: `${name} — репутация изменилась`,
      body: (a.excerpt || 'Обновление профиля').toString().slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: actorLink,
      createdAt: Date.now(),
    })
    return
  }
  const pinTitle = a.pin?.title || a.photo?.caption || 'ваш пин'
  const emoji: Record<string, string> = { like: '❤️', fire: '🔥', laugh: '😂', sad: '😢', angry: '😡', useful: '👍' }
  const body = a.kind === 'comment'
    ? (a.excerpt ? `${name}: ${a.excerpt}` : `${name} прокомментировал «${pinTitle}»`).slice(0, 90)
    : a.kind === 'photo_comment'
      ? (a.excerpt ? `${name}: ${a.excerpt}` : `${name} прокомментировал фото`).slice(0, 90)
      : a.kind === 'mention'
        ? (a.excerpt ? `${name} упомянул вас: ${a.excerpt}` : `${name} упомянул вас в «${pinTitle}»`).slice(0, 90)
        : `${name} ${emoji[a.reaction_type] || '⭐'} «${pinTitle}»`.slice(0, 90)
  push({
    id: `pin-${a.id}-${Date.now()}`,
    type: 'pin',
    title: a.kind === 'comment' || a.kind === 'photo_comment' ? 'Новый комментарий' : a.kind === 'mention' ? 'Вас упомянули' : 'Новая реакция',
    body,
    avatar: avatarSrcFor(actor),
    link: activityLink(a),
    createdAt: Date.now(),
  })
}
function handleUserFeed(e: any) {
  const kind = e?.kind as string | undefined
  if (!kind) return
  const actor = e?.actor || {}
  const name = actor.name || 'Кто-то'
  const p = e?.payload || {}
  if (kind === 'pin') {
    const title = (p.title || 'новый пин').toString().slice(0, 60)
    push({
      id: `feed-pin-${p.pin_id || Date.now()}-${Date.now()}`,
      type: 'pin',
      title: `${name} — новый пин`,
      body: `«${title}»`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: `/users/${actor.id || p.target_id || ''}`,
      createdAt: Date.now(),
    })
  } else if (kind === 'photo') {
    push({
      id: `feed-photo-${p.photo_id || Date.now()}-${Date.now()}`,
      type: 'pin',
      title: `${name} — новое фото`,
      body: 'Загружено новое фото. Откройте галерею'.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: `/users/${actor.id || p.target_id || ''}`,
      createdAt: Date.now(),
    })
  } else if (kind === 'level') {
    const leveledUp = p.old_level && p.old_level !== p.level
    push({
      id: `feed-level-${actor.id || Date.now()}-${Date.now()}`,
      type: 'friend',
      title: leveledUp ? `${name} — новый уровень` : `${name} — репутация изменилась`,
      body: leveledUp ? `Уровень: ${p.level} · ${p.reputation_score ?? 0} ★` : `Репутация: ${p.reputation_score ?? 0} ★`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: `/users/${actor.id || p.target_id || ''}`,
      createdAt: Date.now(),
    })
  }
}
function otherParty(e: any): any {
  const uid = getUid()
  const a = e?.user_a
  const b = e?.user_b
  if (a && b) return Number(a.id) === uid ? b : a
  return b || a || {}
}
function handleMatch(e: any) {
  if (!e?.conversation_id) return
  const other = otherParty(e)
  push({
    id: `match-${e.match_id || e.conversation_id}-${Date.now()}`,
    type: 'match',
    title: '💞 Новый мэтч!',
    body: `${other?.name || 'Кто-то'} тоже лайкнул тебя — чат открыт`,
    avatar: avatarSrcFor(other || {}),
    link: `/chat/${e.conversation_id}?from=swipes`,
    createdAt: Date.now(),
  })
}
function handleSwipeLiked(e: any) {
  const liker = e?.liker
  if (!liker?.id) return
  push({
    id: `liked-${liker.id}-${Date.now()}`,
    type: 'match',
    title: '💘 Тебя лайкнули в ULove',
    body: `${liker.name || 'Кто-то'} отреагировал на твою анкету`,
    avatar: avatarSrcFor(liker),
    link: '/swipes',
    createdAt: Date.now(),
  })
}
function handleImpersonation(e: any) {
  const log = e?.log
  if (!log?.id) return
  push({
    id: `imp-${log.id}-${Date.now()}`,
    type: 'security',
    title: 'Вход администрации в ваш аккаунт',
    body: `${log.reason || 'Основание указано в журнале'}`.slice(0, 90),
    avatar: null,
    link: '/settings/procedures',
    createdAt: Date.now(),
  })
}
function isAdminNow(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin'
  } catch { return false }
}
function handleReport(e: any) {
  if (!adminMode || !e?.report?.id) return
  const r = e.report
  const title = r.target_title || `${r.target_type} #${r.target_id}`
  const body = (r.description ? `${r.description} — ` : '') + `от ${r.reporter?.name || 'пользователя'}`
  push({
    id: `rep-${r.id}-${Date.now()}`,
    type: 'report',
    title: `Жалоба: ${r.reason_label || r.reason}`,
    body: `${title} · ${body}`.slice(0, 90),
    avatar: avatarSrcFor(r.reporter || {}),
    link: '/settings?tab=admin',
    createdAt: Date.now(),
  })
}
function subscribe() {
  try {
    const echo = getEcho()
    if (!echo) return
    const uid = getUid()
    if (!uid) return
    if (echoCh && subscribedUid === uid) return
    if (echoCh && subscribedUid !== null && subscribedUid !== uid) resetAppNotifications()
    if (echoCh) return
    echoCh = echo.private(`user.${uid}`)
    subscribedUid = uid
    adminMode = isAdminNow()
    echoCh.listen('.message.sent', handleMessage)
    echoCh.listen('.friendship.updated', handleFriendship)
    echoCh.listen('.user.feed.updated', handleUserFeed)
    echoCh.listen('UserFeedUpdated', handleUserFeed)
    echoCh.listen('.pin.activity', handlePinActivity)
    echoCh.listen('PinActivityCreated', handlePinActivity)
    echoCh.listen('.match.created', handleMatch)
    echoCh.listen('MatchCreated', handleMatch)
    echoCh.listen('.swipe.liked', handleSwipeLiked)
    echoCh.listen('SwipeLiked', handleSwipeLiked)
    echoCh.listen('.report.created', handleReport)
    echoCh.listen('ReportCreated', handleReport)
    echoCh.listen('.impersonation.started', handleImpersonation)
    echoCh.listen('ImpersonationStarted', handleImpersonation)
    const pusher = (echo as any).connector?.pusher
    if (pusher) pusher.connection.bind('connected', () => { if (!echoCh) subscribe() })
  } catch {}
}
function init() {
  if (inited) return
  inited = true
  subscribe()
  window.addEventListener('focus', subscribe)
}
export function useAppNotifications() {
  onMounted(() => init())
  onBeforeUnmount(() => {})
  function openToast(t: AppToast) { router.visit(t.link); remove(t.id) }
  return { toasts, init, push, remove, openToast, subscribe }
}
