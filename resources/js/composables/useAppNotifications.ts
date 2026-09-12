import { ref, onMounted, onBeforeUnmount } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { avatarSrcFor } from '@/composables/useAvatar'
import { showLocal } from '@/pwa/push.service'
import { useScreenLock } from '@/composables/useScreenLock'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

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
let busBound = false
let subscribedUid: number | null = null
let adminMode = false
let seenMsgIds = new Set<number>()
let seenEventAt = new Map<string, number>()
let timers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Сбросить уведомления при смене аккаунта: покинуть user.* и очистить тосты.
 */
export function resetAppNotifications(): void {
  try {
    leaveUserChannel()
  } catch {}
  subscribedUid = null
  inited = false
  seenMsgIds = new Set<number>()
  seenEventAt = new Map<string, number>()
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
/**
 * Защита от дублей тостов: одно событие дружбы прилетает дважды —
 * поллер шлёт пару `notify:friendship` + `user:friendship.updated`,
 * на оба висит один хендлер, плюс сокет и поллер могут пересечься.
 * Ключ включает статус: pending и accepted позже — разные тосты.
 */
function isDuplicateEvent(key: string, ttlMs = 20000): boolean {
  const now = Date.now()
  const prev = seenEventAt.get(key)
  if (prev !== undefined && now - prev < ttlMs) return true
  seenEventAt.set(key, now)
  if (seenEventAt.size > 200) {
    const first = seenEventAt.keys().next().value as string | undefined
    if (first !== undefined) seenEventAt.delete(first)
  }
  return false
}
function handleFriendship(e: any) {
  const f = e?.friendship
  if (!f) return
  const eventKey = `fr-${f.id}-${f.status}`
  if (isDuplicateEvent(eventKey)) return
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
  const pinTitle = a.pin?.title || a.photo?.caption || 'ваша запись'
  const flowPostId = Number(a?.flow_post?.id || a?.flow_post_id || 0) || null
  const flowLink = flowPostId ? `/flow/post/${flowPostId}` : '/flow'
  const flowExcerpt = (a.excerpt || '').toString().slice(0, 90)
  if (a.kind === 'sub_flow_post') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      title: `${name} — пост в UFlow`,
      body: flowExcerpt || 'Опубликован новый пост',
      avatar: avatarSrcFor(actor),
      link: flowLink,
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'flow_like') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      title: 'Лайк поста',
      body: `${name} оценил ваш пост в UFlow`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: flowLink,
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'flow_comment') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      title: 'Комментарий к посту',
      body: flowExcerpt ? `${name}: ${flowExcerpt}` : `${name} прокомментировал ваш пост`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: flowLink,
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'flow_reply') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      title: 'Ответ на комментарий',
      body: flowExcerpt ? `${name} ответил вам: ${flowExcerpt}` : `${name} ответил на ваш комментарий`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: flowLink,
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'flow_mention') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      title: 'Вас упомянули в UFlow',
      body: flowExcerpt ? `${name} упомянул вас: ${flowExcerpt}` : `${name} упомянул вас в UFlow`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: flowLink,
      createdAt: Date.now(),
    })
    return
  }
  const emoji: Record<string, string> = { like: '❤️', fire: '🔥', laugh: '😂', sad: '😢', angry: '😡', useful: '👍' }
  if (a.kind === 'swipe_like') {
    const anon = a.is_incognito
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'match',
      title: anon ? '💘 Тайный поклонник' : '💘 Тебя лайкнули в ULove',
      body: anon ? 'Тайный поклонник отреагировал на твою анкету' : `${name} отреагировал на твою анкету`.slice(0, 90),
      avatar: anon ? null : avatarSrcFor(actor),
      link: '/swipes?tab=admirers',
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'match') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'match',
      title: '💞 Новый мэтч!',
      body: `${name} тоже лайкнул тебя — чат открыт`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: '/swipes',
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'photo_like') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      title: 'Лайк фото',
      body: `${name} лайкнул ваше фото`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: activityLink(a),
      createdAt: Date.now(),
    })
    return
  }
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
  if (isDuplicateEvent(`match-${e.match_id || e.conversation_id}`)) return
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
  if (isDuplicateEvent(`liked-${liker.id}`)) return
  const anon = !!(liker.is_incognito || e?.is_incognito)
  push({
    id: `liked-${liker.id}-${Date.now()}`,
    type: 'match',
    title: anon ? '💘 Тайный поклонник' : '💘 Тебя лайкнули в ULove',
    body: anon ? 'Тайный поклонник отреагировал на твою анкету' : `${liker.name || 'Кто-то'} отреагировал на твою анкету`,
    avatar: anon ? null : avatarSrcFor(liker),
    link: '/swipes?tab=admirers',
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
    const uid = getUid()
    if (!uid) return
    if (subscribedUid !== null && subscribedUid !== uid) resetAppNotifications()
    subscribedUid = uid
    adminMode = isAdminNow()
    ensureUserChannel()
    if (!busBound) {
      busBound = true
      busOn('user:message.sent', handleMessage)
      busOn('user:friendship.updated', handleFriendship)
      busOn('user:user.feed.updated', handleUserFeed)
      busOn('user:pin.activity', handlePinActivity)
      busOn('user:match.created', handleMatch)
      busOn('user:swipe.liked', handleSwipeLiked)
      busOn('user:report.created', handleReport)
      busOn('user:impersonation.started', handleImpersonation)
      busOn('notify:message', (msg: any) => handleMessage({ message: msg }))
      busOn('notify:friendship', (e: any) => handleFriendship(e))
      busOn('notify:match', (e: any) => handleMatch(e))
      busOn('notify:swipe', (e: any) => handleSwipeLiked(e))
      busOn('notify:activity', (e: any) => handlePinActivity(e))
      busOn('notify:report', (e: any) => handleReport(e))
    }
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
