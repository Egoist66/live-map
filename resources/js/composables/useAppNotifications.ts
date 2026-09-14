import { ref, onMounted, onBeforeUnmount } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { avatarSrcFor } from '@/composables/useAvatar'
import { getSubscription, showLocal } from '@/pwa/push.service'
import { useScreenLock } from '@/composables/useScreenLock'
import { useFileDownload } from '@/composables/useFileDownload'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

function isLockedNow(): boolean {
  try { return useScreenLock().locked.value } catch { return false }
}

export type AppToast = {
  id: string
  type: 'message' | 'friend' | 'pin' | 'report' | 'security' | 'match' | 'sos'
  title: string
  body: string
  avatar: string | null
  link: string
  createdAt: number
  /**
   * PrimeIcon бейджа тоста (например 'pi pi-map-marker').
   * Компонент только отображает, выбор иконки — здесь.
   */
  icon: string
  /**
   * Прямое скачивание по клику: если задано — клик качает файл,
   * а не ведёт по link (история SOS-чата).
   */
  downloadUrl?: string | null
  /** Имя файла для скачивания по клику. */
  fileName?: string | null
  /** Kind активности пина (invite — показать Принять/Отклонить). */
  kind?: string | null
  /** Id пина для accept/decline прямо из тоста. */
  pinId?: number | null
  /** Id строки inbox (uuid) для гашения счётчика после accept/decline. */
  activityId?: string | number | null
}

const toasts = ref<AppToast[]>([])
let inited = false
let busBound = false
let subscribedUid: number | null = null
let adminMode = false
let initialShown = false
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
  initialShown = false
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
    if (typeof document !== 'undefined' && document.hidden) void notifyHidden(t)
  } catch {}
}
/**
 * Системный баннер для скрытой вкладки — без дубля с серверным web-push.
 *
 * Если у устройства есть push-подписка, серверный пуш уже покажет баннер
 * через SW — локальный не нужен. Тег стабилен на событие, чтобы повтор
 * заменил баннер, а не сложил второй.
 */
async function notifyHidden(t: AppToast): Promise<void> {
  // Нативный мост: скрытая вкладка внутри WebView (фон/свёрнуто) — просим приложение
  // показать системное уведомление (шторка + бейдж). На чистом вебе ReactNativeWebView
  // отсутствует — ветка пропускается, поведение веба не меняется.
  try {
    const w = window as any
    if (w?.ReactNativeWebView?.postMessage) {
      const kind = t.type === 'message' ? 'message' : t.type === 'match' ? 'chat' : 'social'
      const url = t.link.startsWith('http') ? t.link : `${window.location.origin}${t.link.startsWith('/') ? '' : '/'}${t.link}`
      w.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'notify',
        kind,
        eventId: t.id,
        title: t.title,
        body: t.body,
        url,
      }))
    }
  } catch {}
  try {
    const sub = await getSubscription().catch(() => null)
    if (sub) return
    const tag = t.id.replace(/-\d+$/, '')
    await showLocal(t.title, { body: t.body, url: t.link, avatar: t.avatar, tag })
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
    icon: 'pi pi-comments',
    title: name,
    body: body || 'Новое сообщение',
    avatar: avatarSrcFor(sender),
    link: `/chat/${msg.conversation_id}`,
    createdAt: Date.now(),
  })
}
/**
 * Защита от дублей тостов: сокет и поллер несут одну строку inbox,
 * ключ стабилен на событие. Ключ дружбы включает статус: pending
 * и accepted позже — разные тосты.
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
/**
 * Тост заявки/решения по UDistrict-району.
 */
function handleDistrict(district: any, type: string) {
  const id = Number(district?.id) || 0
  if (!id) return
  if (isDuplicateEvent(`district-${type}-${id}`)) return
  const link = `/map?district=${id}`
  if (type === 'district.join_requested') {
    const r = district.requester || {}
    push({
      id: `district-req-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-home',
      title: `Заявка в район «${String(district.name || '').slice(0, 40)}»`,
      body: `${r.name || 'Кто-то'} хочет жить в вашем районе`,
      avatar: avatarSrcFor(r),
      link,
      createdAt: Date.now(),
    })
    return
  }
  if (type === 'district.request_approved') {
    push({
      id: `district-ok-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-check-circle',
      title: `Вы в районе «${String(district.name || '').slice(0, 40)}»`,
      body: 'Пины района и общий чат открыты',
      avatar: null,
      link,
      createdAt: Date.now(),
    })
    return
  }
  if (type === 'district.invited') {
    const inviter = district.inviter || {}
    push({
      id: `district-invite-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-ticket',
      title: `Приглашение в район «${String(district.name || '').slice(0, 40)}»`,
      body: `${inviter.name || 'Владелец'} добавил вас в жители — чат открыт`,
      avatar: avatarSrcFor(inviter),
      link,
      createdAt: Date.now(),
    })
  }
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
      icon: 'pi pi-user-plus',
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
      icon: 'pi pi-user-plus',
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
  if (isDuplicateEvent(`act-${a.id}`)) return
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
      icon: 'pi pi-map-marker',
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
      icon: 'pi pi-image',
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
      icon: 'pi pi-star',
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
      icon: 'pi pi-file',
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
      icon: 'pi pi-heart',
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
      icon: 'pi pi-comments',
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
      icon: 'pi pi-comments',
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
      icon: 'pi pi-at',
      title: 'Вас упомянули в UFlow',
      body: flowExcerpt ? `${name} упомянул вас: ${flowExcerpt}` : `${name} упомянул вас в UFlow`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: flowLink,
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'invite') {
    const title = (a.pin?.title || 'пин').toString().slice(0, 60)
    const pinId = Number((a as any).pin?.id || (a as any).pin_id || 0) || null
    push({
      id: `pin-invite-${a.id}-${Date.now()}`,
      type: 'pin',
      icon: 'pi pi-ticket',
      title: `🎫 ${name} приглашает в пин`,
      body: `«${title}» — видно вне зоны · открывай и комментируй`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: activityLink(a),
      createdAt: Date.now(),
      kind: 'invite',
      pinId,
      activityId: a.id,
    })
    return
  }
  if (a.kind === 'invite_accepted') {
    const title = (a.pin?.title || 'пин').toString().slice(0, 60)
    push({
      id: `pin-invite-acc-${a.id}-${Date.now()}`,
      type: 'pin',
      icon: 'pi pi-check-circle',
      title: `✅ ${name} принял приглашение`,
      body: `«${title}» — можно смотреть вместе`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: activityLink(a),
      createdAt: Date.now(),
      kind: 'invite_accepted',
      pinId: Number((a as any).pin?.id || (a as any).pin_id || 0) || null,
      activityId: a.id,
    })
    return
  }
  const emoji: Record<string, string> = { like: '❤️', fire: '🔥', laugh: '😂', sad: '😢', angry: '😡', useful: '👍' }
  if (a.kind === 'swipe_like') {
    const anon = a.is_incognito
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'match',
      icon: 'pi pi-heart-fill',
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
      icon: 'pi pi-heart-fill',
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
      icon: 'pi pi-heart',
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
  const isCommentKind = a.kind === 'comment' || a.kind === 'photo_comment'
  const isMentionKind = a.kind === 'mention'
  push({
    id: `pin-${a.id}-${Date.now()}`,
    type: 'pin',
    icon: isCommentKind ? 'pi pi-comments' : isMentionKind ? 'pi pi-at' : 'pi pi-heart',
    title: isCommentKind ? 'Новый комментарий' : isMentionKind ? 'Вас упомянули' : 'Новая реакция',
    body,
    avatar: avatarSrcFor(actor),
    link: activityLink(a),
    createdAt: Date.now(),
  })
}
/**
 * Единый вход тостов: строка inbox-таблицы notifications.
 *
 * Один тип — один строитель тоста, сокет и поллер несут одну и ту же
 * строку (ключ notif-{id}), поэтому дублей нет по построению.
 */
function handleNotification(e: any) {
  const n = e?.notification
  if (!n?.id) return
  // Прочитанные строки тост не дают: они уже в ленте колокольчика.
  // Иначе тост всплывал бы по открытию колокольчика / после read-all.
  if (n.read_at) return
  if (isDuplicateEvent(`notif-${n.id}`)) return
  const data = n.data ?? {}
  if (data.sos_chat_closed) {
    handleSosChatClosed(data.sos_chat_closed)
    return
  }
  if (data.activity) {
    handlePinActivity({ activity: data.activity })
    return
  }
  if (data.friendship) {
    handleFriendship({ friendship: data.friendship })
    return
  }
  if (data.district) {
    handleDistrict(data.district, String(n.type || ''))
    return
  }
  if (data.report) {
    handleReport({ report: data.report })
    return
  }
  if (data.log) {
    handleImpersonation({ log: data.log })
    return
  }
}
function handleSosChatClosed(s: any) {
  const cid = Number(s?.conversation_id ?? 0) || 0
  if (isDuplicateEvent(`sos-closed-${cid}-${s?.reason ?? 'closed'}`)) return
  const title = s?.pin_title ? `🆘 SOS-чат закрыт: ${s.pin_title}` : '🆘 SOS-чат закрыт'
  const downloadUrl = String(s?.archive_download_url || s?.archive_url || '') || null
  const fileName = String(s?.archive_name || 'SOS-чат.txt')
  push({
    id: `sos-closed-${cid}-${Date.now()}`,
    type: 'sos',
    icon: 'pi pi-exclamation-triangle',
    title,
    body: 'Нажмите, чтобы скачать историю чата.'.slice(0, 90),
    avatar: null,
    link: downloadUrl || '/chat',
    downloadUrl,
    fileName,
    createdAt: Date.now(),
  })
}
function handleImpersonation(e: any) {
  const log = e?.log
  if (!log?.id) return
  if (isDuplicateEvent(`imp-${log.id}`)) return
  push({
    id: `imp-${log.id}-${Date.now()}`,
    type: 'security',
    icon: 'pi pi-shield',
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
  if (isDuplicateEvent(`rep-${e.report.id}`)) return
  const r = e.report
  const title = r.target_title || `${r.target_type} #${r.target_id}`
  const body = (r.description ? `${r.description} — ` : '') + `от ${r.reporter?.name || 'пользователя'}`
  push({
    id: `rep-${r.id}-${Date.now()}`,
    type: 'report',
    icon: 'pi pi-flag',
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
      busOn('user:notification.created', handleNotification)
    }
  } catch {}
}
/**
 * Показать тосты для уже висящих непрочитанных при входе.
 *
 * Берём последние 3 непрочитанные строки inbox и прогоняем через
 * тот же handleNotification — дедуп по notif-{id} не даст дублей
 * с живым сокетом/поллером. Строки НЕ помечаем прочитанными:
 * закрытие тоста (крестик/автохайд) счётчик колокольчика не трогает,
 * гаснет он только явным «прочитать» в колокольчике.
 */
async function showInitialUnreads(): Promise<void> {
  if (initialShown) return
  initialShown = true
  try {
    const { notificationsApi } = await import('@/services/notifications.api')
    const rows = await notificationsApi.list().catch(() => [] as any[])
    const unread = (Array.isArray(rows) ? rows : [])
      .filter((n: any) => !n?.read_at)
      .slice(0, 3)
    for (const n of unread) {
      try {
        handleNotification({ notification: n })
      } catch {}
    }
  } catch {}
}
function init() {
  if (inited) return
  inited = true
  subscribe()
  void showInitialUnreads()
  window.addEventListener('focus', subscribe)
}
export function useAppNotifications() {
  onMounted(() => init())
  onBeforeUnmount(() => {})
  /**
   * Клик по тосту: файл (история SOS) — сразу скачать, иначе переход.
   */
  function openToast(t: AppToast) {
    if (t.downloadUrl) {
      const name = t.fileName || 'SOS-чат.txt'
      void useFileDownload().download(t.downloadUrl, name)
      remove(t.id)

      return
    }
    router.visit(t.link); remove(t.id)
  }
  return { toasts, init, push, remove, openToast, subscribe }
}
