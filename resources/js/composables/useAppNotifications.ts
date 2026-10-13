import { ref, onMounted, onBeforeUnmount } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { avatarSrcFor } from '@/composables/useAvatar'
import { showLocal, type ForegroundPush } from '@/pwa/push.service'
import { useScreenLock } from '@/composables/useScreenLock'
import { useFileDownload } from '@/composables/useFileDownload'
import { busOn } from '@/services/realtime-bus'
import { subjectWord } from '@/services/notifications.api'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'
import { captureAuthUid, currentAuthUid } from '@/composables/useAuthUid'
import { useProfileUrl } from '@/composables/useProfileUrl'
import { useNotificationModules } from '@/composables/useNotificationModules'

function isLockedNow(): boolean {
  try { return useScreenLock().locked.value } catch { return false }
}

export type AppToast = {
  id: string
  type: 'message' | 'friend' | 'pin' | 'report' | 'security' | 'match' | 'sos' | 'business'
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
  /** Id района для accept/decline приглашения прямо из тоста. */
  districtId?: number | null
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
  toastedInboxIds.clear()
  seenMsgIds = new Set<number>()
  seenEventAt = new Map<string, number>()
  timers.forEach((t) => clearTimeout(t))
  timers = new Map()
  toasts.value = []
}

/**
 * Id текущего пользователя для фильтров тостов.
 *
 * Обработчики шины (`user:message.sent` и др.) вызываются вне
 * setup-контекста, где `usePage()` недоступен и возвращает 0 —
 * из-за этого свои сообщения не отфильтровывались и тостили
 * отправителя. Поэтому сначала читаем кэш `useAuthUid`
 * (захватывается в setup ниже через `captureAuthUid()`),
 * и только потом — запасные источники.
 */
function getUid(): number {
  const cached = currentAuthUid()
  if (cached > 0) return cached
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
function canVibrateNow(): boolean {
  try {
    const nav = navigator as Navigator & { userActivation?: { hasBeenActive?: boolean; isActive?: boolean } }
    if (nav.userActivation) return !!(nav.userActivation.hasBeenActive || nav.userActivation.isActive)
  } catch {}
  return false
}
function playTick() {
  try {
    const ctx = (window as any)._audioCtx as AudioContext | undefined
    let ac: AudioContext
    if (!ctx) { ac = new (window.AudioContext || (window as any).webkitAudioContext)(); (window as any)._audioCtx = ac } else ac = ctx
    if (ac.state === 'suspended') { void ac.resume().catch(() => {}) }
    if (ac.state !== 'running') return
    const o = ac.createOscillator(); const g = ac.createGain()
    o.frequency.value = 880; o.type = 'sine'; g.gain.value = 0.08
    o.connect(g).connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.22); o.stop(ac.currentTime + 0.23)
  } catch {}
}
function push(t: AppToast) {
  if (isLockedNow()) return
  noteToastSignature(t.title, t.body)
  toasts.value = [t, ...toasts.value].slice(0, 3)
  playTick()
  const timer = setTimeout(() => remove(t.id), 5500)
  timers.set(t.id, timer)
  if ('vibrate' in navigator && canVibrateNow()) try { (navigator as any).vibrate(120) } catch {}
  try {
    if (typeof document !== 'undefined' && document.hidden) void notifyHidden(t)
  } catch {}
}
/**
 * Системный баннер для скрытой вкладки — быстрый локальный путь.
 *
 * Срабатывает из шины (`user:message.sent` несут и сокет Echo, и поллер),
 * поэтому покрывает оба транспорта realtime. Показывается всегда, а не
 * только без push-подписки: тег стабилен на событие и совпадает с серверным
 * web-push, так что долетевший позже серверный баннер заменит локальный.
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
    const tag = stableHiddenTag(t)
    await showLocal(t.title, { body: t.body, url: t.link, avatar: t.avatar, tag })
  } catch {}
}
/**
 * Стабильный тег системного баннера: для чата совпадает с серверным
 * web-push (`chat-{id}`), повторы заменяют баннер, а не плодят новый.
 *
 * @param t тост, для которого строится тег
 * @returns тег уведомления
 */
function stableHiddenTag(t: AppToast): string {
  if (t.type === 'message') {
    const match = t.link.match(/\/chat\/(\d+)/)
    if (match) {
      return `chat-${match[1]}`
    }
  }
  return t.id.replace(/-\d+$/, '')
}
function remove(id: string) {
  toasts.value = toasts.value.filter(x => x.id !== id)
  const tm = timers.get(id); if (tm) { clearTimeout(tm); timers.delete(id) }
}
/** Сигнатуры недавно показанных тостов: защита SW-фолбэка от дублей с Echo. */
const recentToastSignatures = new Map<string, number>()
const SIGNATURE_TTL_MS = 10000
const SW_FALLBACK_DELAY_MS = 1500

function toastSignature(title: string, body: string): string {
  const raw = `${title} ${body}`.toLowerCase().replace(/\s+/g, ' ').trim()
  return raw.slice(0, 160)
}

function noteToastSignature(title: string, body: string): void {
  try {
    recentToastSignatures.set(toastSignature(title, body), Date.now())
    if (recentToastSignatures.size > 200) {
      const first = recentToastSignatures.keys().next().value as string | undefined
      if (first !== undefined) recentToastSignatures.delete(first)
    }
  } catch {}
}

function seenToastRecently(title: string, body: string): boolean {
  try {
    const at = recentToastSignatures.get(toastSignature(title, body))
    return at !== undefined && Date.now() - at < SIGNATURE_TTL_MS
  } catch {
    return false
  }
}

function swPushToastKind(link: string): { type: AppToast['type']; icon: string } {
  if (link.startsWith('/chat')) return { type: 'message', icon: 'pi pi-comments' }
  if (link.startsWith('/swipes')) return { type: 'match', icon: 'pi pi-heart-fill' }
  if (link.startsWith('/flow')) return { type: 'pin', icon: 'pi pi-file' }
  if (link.startsWith('/map')) return { type: 'pin', icon: 'pi pi-map-marker' }
  return { type: 'pin', icon: 'pi pi-bell' }
}
/**
 * Фолбэк тоста из сервис-воркера (`upin:sw-push`).
 *
 * SW пересылает пуш сфокусированной вкладке вместо системного баннера.
 * Если Echo жив — тот же тост уже показан, гасим по сигнатуре с задержкой.
 * Если сокет мёртв — это единственная доставка: in-app тост, а для успевшей
 * скрыться вкладки — локальный баннер (серверный SW сознательно пропустил).
 */
function handleSwPush(event: Event): void {
  const detail = (event as CustomEvent<ForegroundPush>).detail
  if (!detail) return
  const title = String(detail.title || 'ULove').slice(0, 120)
  const body = String(detail.body || 'Новое уведомление').slice(0, 140)
  const link = String(detail.url || '/map')
  const tag = String(detail.tag || 'upin-push')
  const avatar = typeof detail.avatar === 'string' ? detail.avatar : null
  if (seenToastRecently(title, body)) return
  window.setTimeout(() => {
    try {
      if (isLockedNow()) return
      if (seenToastRecently(title, body)) return
      if (typeof document !== 'undefined' && document.hidden) {
        void showLocal(title, { body, url: link, avatar, tag: `sw-${tag}` })
        return
      }
      const kind = swPushToastKind(link)
      push({
        id: `sw-${tag}-${Date.now()}`,
        type: kind.type,
        icon: kind.icon,
        title,
        body,
        avatar,
        link,
        createdAt: Date.now(),
      })
    } catch {}
  }, SW_FALLBACK_DELAY_MS)
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
 * Тост событий UDistrict: заявки, пины внутри, новости района.
 *
 * Жители получают новости района и пины внутри — ссылка всегда
 * ведёт сразу на страницу района без захода на карту.
 *
 * @param district полезная нагрузка района из уведомления
 * @param type тип строки inbox
 * @param activity activity-пейлоад с актором для аватара
 */
function handleDistrict(district: any, type: string, activity: any = null) {
  const id = Number(district?.id) || 0
  if (!id) return
  const detailKey = String(
    district.pin_id ?? district.post_id ?? district.comment_id ?? district.post_title ?? '',
  )
  if (isDuplicateEvent(`district-${type}-${id}-${detailKey}`)) return
  const link = `/districts/${id}`
  const actorAvatar = avatarSrcFor(activity?.actor ?? null)
  if (type === 'district.join_requested') {
    const r = district.requester || {}
    const requesterName = r.name || 'Кто-то'
    const subject = subjectWord(r)
    const purpose = String(district.request_message ?? r.request_message ?? '').trim()
    const purposeSuffix = purpose !== '' ? ` · Цель: ${purpose.slice(0, 80)}` : ''
    push({
      id: `district-req-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-home',
      title: `${subject} ${requesterName} — заявка в район`,
      body: `${subject} ${requesterName} отправил заявку на вступление в район «${String(district.name || '').slice(0, 40)}»${purposeSuffix}`,
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
  if (type === 'district.request_rejected') {
    push({
      id: `district-no-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-times-circle',
      title: `Заявка в «${String(district.name || '').slice(0, 40)}» отклонена`,
      body: 'Владелец решил не пускать — можно написать ему в личку',
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
      body: `${inviter.name || 'Владелец'} зовёт в жители — примите или отклоните`,
      avatar: avatarSrcFor(inviter),
      link,
      createdAt: Date.now(),
      kind: 'district-invite',
      districtId: id,
    })
    return
  }
  if (type === 'district.invite_accepted') {
    const accepter = district.accepter || {}
    const verb = subjectWord(accepter) === 'Организация' ? 'приняла приглашение' : 'принял приглашение'
    push({
      id: `district-invite-acc-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-check-circle',
      title: `${accepter.name || 'Новый житель'} ${verb}`,
      body: `Район «${String(district.name || '').slice(0, 40)}» — пины и чат открыты`,
      avatar: avatarSrcFor(accepter),
      link,
      createdAt: Date.now(),
    })
    return
  }
  if (type === 'district.pin_created') {
    const pinTitle = String(district.pin_title || '').slice(0, 60)
    push({
      id: `district-pin-${id}-${Date.now()}`,
      type: 'pin',
      icon: 'pi pi-map-marker',
      title: `Новый пин в «${String(district.name || '').slice(0, 40)}»`,
      body: pinTitle ? `«${pinTitle}»` : 'Житель поставил пин внутри района',
      avatar: actorAvatar,
      link,
      createdAt: Date.now(),
    })
    return
  }
  if (type === 'district.post_published') {
    const postTitle = String(district.post_title || district.post_excerpt || '').slice(0, 60)
    push({
      id: `district-post-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-megaphone',
      title: `Новость в «${String(district.name || '').slice(0, 40)}»`,
      body: postTitle || 'Владелец опубликовал новость',
      avatar: actorAvatar,
      link,
      createdAt: Date.now(),
    })
    return
  }
  if (type === 'district.post_commented') {
    const excerpt = String(district.excerpt || '').slice(0, 80)
    push({
      id: `district-post-comment-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-comment',
      title: `Комментарий в «${String(district.name || '').slice(0, 40)}»`,
      body: excerpt || 'Новый комментарий к новости',
      avatar: actorAvatar,
      link,
      createdAt: Date.now(),
    })
    return
  }
  if (type === 'district.post_replied') {
    const excerpt = String(district.excerpt || '').slice(0, 80)
    push({
      id: `district-post-reply-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-reply',
      title: `Ответ в «${String(district.name || '').slice(0, 40)}»`,
      body: excerpt || 'Ответили на ваш комментарий',
      avatar: actorAvatar,
      link,
      createdAt: Date.now(),
    })
    return
  }
  if (type === 'district.post_liked') {
    push({
      id: `district-post-like-${id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-heart',
      title: `Лайк в «${String(district.name || '').slice(0, 40)}»`,
      body: 'Оценили вашу новость',
      avatar: actorAvatar,
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
    const verb = subjectWord(a) === 'Организация' ? 'приняла заявку' : 'принял заявку'
    push({
      id: `fr-acc-${f.id}-${Date.now()}`,
      type: 'friend',
      icon: 'pi pi-user-plus',
      title: 'Заявка принята',
      body: `${a.name || 'Пользователь'} ${verb}`,
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
  const { userProfileUrl } = useProfileUrl()
  const pinId = Number(a?.pin?.id || a?.pin_id || 0) || null
  const commentId = Number(a?.comment_id || 0) || null
  const photoId = Number(a?.photo?.id || a?.photo_id || 0) || null
  const photoCommentId = Number(a?.photo_comment_id || 0) || null
  const actor = (a?.actor ?? null) as { id?: number; profile_slug?: string | null } | null
  const actorId = Number(a?.actor?.id || a?.actor_id || 0) || null
  const photoUserId = Number(a?.photo?.user_id || actorId || 0) || null
  if (pinId) {
    return `/map?pin=${pinId}${commentId ? `&comment=${commentId}` : ''}`
  }
  if (photoId && photoUserId) {
    const isActorPhoto = actor !== null && Number(actor.id || 0) === photoUserId
    const photoOwner = isActorPhoto ? actor : { id: photoUserId }
    return userProfileUrl(photoOwner, { photo: photoId, comment: photoCommentId })
  }
  if (actorId) {
    return userProfileUrl(actor ?? { id: actorId })
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
  if (a.kind === 'scheduled_published') {
    const title = (a.excerpt || a.pin?.title || 'пин').toString().slice(0, 60)
    push({
      id: `pin-scheduled-${a.id}-${Date.now()}`,
      type: 'pin',
      icon: 'pi pi-clock',
      title: 'Ваш запланированный пин опубликован',
      body: `«${title}» уже на карте`.slice(0, 90),
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
    return
  }
  const pinTitle = a.pin?.title || a.photo?.caption || null
  const pinTitleOrExcerpt = pinTitle || (a.excerpt || '').toString().slice(0, 60) || null
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
  if (a.kind === 'flow_repost') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      icon: 'pi pi-forward',
      title: 'Репост',
      body: flowExcerpt ? `${name}: ${flowExcerpt}` : `${name} поделился вашим постом в UFlow`.slice(0, 90),
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
  if (a.kind === 'rewards_weekly') {
    const excerpt = (a.excerpt || '').toString().slice(0, 90)
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      icon: 'pi pi-star',
      title: 'Итог недели',
      body: excerpt || 'Начислены очки активности за неделю',
      avatar: avatarSrcFor(actor),
      link: '/profile/edit',
      createdAt: Date.now(),
    })
    return
  }
  if (
    a.kind === 'district_pin' ||
    a.kind === 'district_post' ||
    a.kind === 'district_post_comment' ||
    a.kind === 'district_post_reply' ||
    a.kind === 'district_post_like'
  ) {
    // Районные виды обычно идут с data.district и обрабатываются в handleDistrict.
    // Сюда попадают только старые/урезанные строки без district — ведём в ленту,
    // а не на пустую карту, чтобы тост не «пропадал».
    const excerpt = (a.excerpt || (a as any).pin?.title || '').toString().slice(0, 90)
    const titles: Record<string, string> = {
      district_pin: 'Новый пин в районе',
      district_post: 'Новость района',
      district_post_comment: 'Комментарий в районе',
      district_post_reply: 'Ответ в районе',
      district_post_like: 'Лайк в районе',
    }
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'pin',
      icon: 'pi pi-home',
      title: titles[a.kind] || 'Район',
      body: excerpt ? `${name}: ${excerpt}` : `${name} — активность в районе`,
      avatar: avatarSrcFor(actor),
      link: activityLink(a),
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
  if (a.kind === 'review') {
    const stars = Number((a as unknown as { rating?: number }).rating || 0) || 0
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'match',
      icon: 'pi pi-star-fill',
      title: '⭐ Новый отзыв',
      body: (stars > 0 ? `${name} оценил(а) тебя на ${stars} из 5` : `${name} оставил(а) отзыв о тебе`).slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: '/profile',
      createdAt: Date.now(),
    })
    return
  }
  if (a.kind === 'profile_visit') {
    push({
      id: `pin-${a.id}-${Date.now()}`,
      type: 'match',
      icon: 'pi pi-eye',
      title: '👀 Гость в профиле',
      body: `${name} заходил(а) в ваш профиль`.slice(0, 90),
      avatar: avatarSrcFor(actor),
      link: activityLink(a),
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
  const titleOrExcerpt = pinTitleOrExcerpt || 'новая активность'
  const body = a.kind === 'comment'
    ? (a.excerpt ? `${name}: ${a.excerpt}` : `${name} прокомментировал «${titleOrExcerpt}»`).slice(0, 90)
    : a.kind === 'photo_comment'
      ? (a.excerpt ? `${name}: ${a.excerpt}` : `${name} прокомментировал фото`).slice(0, 90)
      : a.kind === 'photo_reply'
        ? (a.excerpt ? `${name} ответил вам: ${a.excerpt}` : `${name} ответил на ваш комментарий к фото`).slice(0, 90)
        : a.kind === 'mention'
          ? (a.excerpt ? `${name} упомянул вас: ${a.excerpt}` : `${name} упомянул вас в «${titleOrExcerpt}»`).slice(0, 90)
          : a.kind === 'reaction'
            ? (`${name} ${emoji[a.reaction_type || ''] || '❤️'} «${titleOrExcerpt}»`).slice(0, 90)
            : (a.excerpt ? `${name}: ${a.excerpt}` : `${name} — ${titleOrExcerpt}`).slice(0, 90)
  const isCommentKind = a.kind === 'comment' || a.kind === 'photo_comment'
  const isMentionKind = a.kind === 'mention'
  const isReplyKind = a.kind === 'photo_reply'
  push({
    id: `pin-${a.id}-${Date.now()}`,
    type: 'pin',
    icon: isCommentKind ? 'pi pi-comments' : isMentionKind ? 'pi pi-at' : isReplyKind ? 'pi pi-reply' : 'pi pi-heart',
    title: isCommentKind ? 'Новый комментарий' : isMentionKind ? 'Вас упомянули' : isReplyKind ? 'Ответ на комментарий' : 'Новая реакция',
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
  // Чужой раздел: тост только своего набора модулей (чат и ULove — всегда).
  try {
    if (!useNotificationModules().allows(n.type)) return
  } catch {}
  if (isDuplicateEvent(`notif-${n.id}`)) return
  const data = n.data ?? {}
  if (data.sos_chat_closed) {
    handleSosChatClosed(data.sos_chat_closed)
    return
  }
  if (data.district && String(n.type || '').startsWith('district.')) {
    handleDistrict(data.district, String(n.type || ''), data.activity ?? null)
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
    handleDistrict(data.district, String(n.type || ''), data.activity ?? null)
    return
  }
  if (data.report) {
    handleReport({ report: data.report })
    return
  }
  if (data.cooperation) {
    handleCooperation({ cooperation: data.cooperation })
    return
  }
  if (data.support) {
    handleSupport({ support: data.support })
    return
  }
  if (data.business && String(n.type || '').startsWith('business.')) {
    handleBusinessInbox(String(n.type), data.business)
    return
  }
  if (data.new_device) {
    handleNewDevice({ device: data.new_device })
    return
  }
  if (data.log) {
    handleImpersonation({ log: data.log })
    return
  }
}

/**
 * Тост из inbox-строки бизнеса (polling/toast-fallback путь).
 *
 * Сокет и поллер несут одну строку (дедуп notif-{id} выше),
 * тип строки: business.submitted|business.verified|business.rejected.
 * @param type тип inbox-строки
 * @param business пейлоад компании
 */
function handleBusinessInbox(type: string, business: any): void {
  if (type === 'business.verified') {
    handleBusinessVerified({ business })
    return
  }
  if (type === 'business.rejected') {
    handleBusinessRejected({ business })
    return
  }
  if (type === 'business.submitted') {
    handleBusinessSubmitted({ business })
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
    title: 'Служебный вход в ваш аккаунт',
    body: `${log.reason || 'Основание указано в журнале'}`.slice(0, 90),
    avatar: null,
    link: '/settings/procedures',
    createdAt: Date.now(),
  })
}
/**
 * Тост входа с нового устройства (inbox-строка security.new_device).
 *
 * Отдельного сокет-события у типа нет — едет только inbox-строкой,
 * поэтому без этой ветки по сокету и поллеру был лишь бейдж без тоста.
 *
 * @param e пейлоад с ключом device {device_label, city, country, ip}
 */
function handleNewDevice(e: any) {
  const d = e?.device
  if (!d?.device_id) return
  if (isDuplicateEvent(`new-device-${d.device_id}`)) return
  const place = [d.city, d.country, d.ip].filter((x: unknown) => String(x ?? '').trim() !== '').join(' · ')
  const label = String(d.device_label || 'Новое устройство')
  push({
    id: `new-device-${d.device_id}-${Date.now()}`,
    type: 'security',
    icon: 'pi pi-key',
    title: 'Вход с нового устройства',
    body: `${label}${place ? ` · ${place}` : ''}`.slice(0, 90),
    avatar: null,
    link: '/settings',
    createdAt: Date.now(),
  })
}
function isAdminNow(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin' || u?.role === 'moderator'
  } catch { return false }
}
function handleReport(e: any) {
  if (!adminMode || !e?.report?.id) return
  if (isDuplicateEvent(`rep-${e.report.id}`)) return
  const r = e.report
  const title = r.target_title || `${r.target_type} #${r.target_id}`
  const from = r.reporter?.name ? r.reporter.name : subjectWord(r.reporter) === 'Организация' ? 'организации' : 'пользователя'
  const body = (r.description ? `${r.description} — ` : '') + `от ${from}`
  push({
    id: `rep-${r.id}-${Date.now()}`,
    type: 'report',
    icon: 'pi pi-flag',
    title: `Жалоба: ${r.reason_label || r.reason}`,
    body: `${title} · ${body}`.slice(0, 90),
    avatar: avatarSrcFor(r.reporter || {}),
    link: '/settings/admin',
    createdAt: Date.now(),
  })
}
/**
 * Заявка на сотрудничество: тост администраторам.
 *
 * Приходит inbox-строкой cooperation.request (сокет, поллер,
 * 20с-фолбэк — везде один id, дублей нет по построению).
 *
 * @param e пейлоад с ключом cooperation {company, email, message}
 */
function handleCooperation(e: any) {
  if (!isAdminNow()) return
  const c = e?.cooperation
  if (!c?.company || !c?.email) return
  if (isDuplicateEvent(`coop-${c.email}-${c.company}`)) return
  push({
    id: `coop-${Date.now()}`,
    type: 'business',
    icon: 'pi pi-briefcase',
    title: `🤝 Сотрудничество: ${String(c.company).slice(0, 40)}`,
    body: `${String(c.message || 'Хотят обсудить сотрудничество')} — ${c.email}`.slice(0, 90),
    avatar: null,
    link: '/admin',
    createdAt: Date.now(),
  })
}

/**
 * Тост из inbox-строки поддержки (только админам).
 *
 * Приходит inbox-строкой support.request (сокет, поллер,
 * 20с-фолбэк — везде один id, дублей нет по построению).
 *
 * @param e пейлоад с ключом support {subject, message, name, email}
 */
function handleSupport(e: any) {
  if (!isAdminNow()) return
  const c = e?.support
  if (!c?.subject || !c?.email) return
  if (isDuplicateEvent(`support-${c.email}-${c.subject}`)) return
  push({
    id: `support-${Date.now()}`,
    type: 'business',
    icon: 'pi pi-life-buoy',
    title: `🛟 Поддержка: ${String(c.subject).slice(0, 40)}`,
    body: `${String(c.message || 'Новое обращение')} — ${c.name || c.email}`.slice(0, 90),
    avatar: null,
    link: '/admin',
    createdAt: Date.now(),
  })
}
/**
 * Страховка тостов при мёртвом realtime.
 *
 * Симптом: подписчик видит +1 в колокольчике (цифры едут REST-опросом
 * бейджей), а тост не всплывает — сокет молчит и user:notification.created
 * не приходит. Раз в TOAST_POLL_MS смотрим свежие непрочитанные строки
 * inbox и прогоняем через тот же handleNotification. При живом сокете
 * пропускаем тик: события и так показывают тосты, дубли не нужны
 * (двойная защита — recordInboxToast + 20с-дедуп notif-{id}).
 */

const TOAST_POLL_MS = 20000
const TOAST_FRESH_MS = 120000
let toastPollTimer: ReturnType<typeof setInterval> | null = null
/** Id inbox-строк, уже показанных тостами (живут дольше 20с-дедупа). */
const toastedInboxIds = new Set<string>()

/** Жив ли сокет: тогда тосты едут событиями, опрос не нужен. */
function socketAlive(): boolean {
  try {
    const echo = (window as any).Echo
    return echo?.connector?.pusher?.connection?.state === 'connected'
  } catch {
    return false
  }
}

/**
 * Запомнить строку, пришедшую живым событием, чтобы опрос не продублировал.
 *
 * @param e событие user:notification.created
 */
function recordInboxToast(e: any): void {
  try {
    const id = String(e?.notification?.id ?? '')
    if (!id) return
    toastedInboxIds.add(id)
    if (toastedInboxIds.size > 200) {
      const first = toastedInboxIds.values().next().value as string | undefined
      if (first !== undefined) toastedInboxIds.delete(first)
    }
  } catch {}
}

/**
 * Возраст строки inbox в мс (по updated_at, иначе created_at).
 *
 * @param n строка inbox
 * @returns возраст или null когда дату не разобрать
 */
function rowAgeMs(n: any): number | null {
  try {
    const raw = n?.updated_at || n?.created_at
    const at = raw ? Date.parse(String(raw)) : NaN
    if (!Number.isFinite(at)) return null
    return Date.now() - at
  } catch {
    return null
  }
}

/**
 * Добить тосты опросом inbox (мёртвый сокет, отвалившийся user-канал).
 * Старые непрочитанные не трогаем: их пользователь уже видел в ленте.
 */
async function pollToastUnreads(): Promise<void> {
  if (typeof document !== 'undefined' && document.hidden) return
  if (!subscribedUid) return
  if (socketAlive()) return
  try {
    const { notificationsApi } = await import('@/services/notifications.api')
    const rows = await notificationsApi.list().catch(() => [] as any[])
    const list = Array.isArray(rows) ? rows : []
    let toasted = 0
    for (const n of list) {
      try {
        const id = String(n?.id ?? '')
        if (!id || n?.read_at) continue
        if (toastedInboxIds.has(id)) continue
        toastedInboxIds.add(id)
        const age = rowAgeMs(n)
        if (age === null || age > TOAST_FRESH_MS) continue
        handleNotification({ notification: n })
        toasted += 1
      } catch {}
    }
    if (toasted > 0) {
      try {
        console.info(`[notify] toast fallback: ${toasted}`)
      } catch {}
    }
  } catch {}
}
function handleBusinessVerified(e: { business?: { id?: number; name?: string } }): void {
  const business = e?.business
  if (!business?.id) return
  if (isDuplicateEvent(`biz-verified-${business.id}`)) return
  push({
    id: `biz-verified-${business.id}-${Date.now()}`,
    type: 'business',
    icon: 'pi pi-verified',
    title: 'Компания проверена',
    body: `${business.name ?? 'Бизнес'} — бейдж «Проверено» включён`.slice(0, 90),
    avatar: null,
    link: '/cabinet',
    createdAt: Date.now(),
  })
}

function handleBusinessSubmitted(e: { business?: { id?: number; name?: string; unp?: string | null } }): void {
  if (!adminMode || !e?.business?.id) return
  const business = e.business
  if (isDuplicateEvent(`biz-sub-${business.id}`)) return
  push({
    id: `biz-sub-${business.id}-${Date.now()}`,
    type: 'business',
    icon: 'pi pi-briefcase',
    title: 'Новая заявка бизнеса',
    body: `${business.name ?? 'Компания'} — проверка по УНП${business.unp ? ` ${business.unp}` : ''}`.slice(0, 90),
    avatar: null,
    link: '/admin/business',
    createdAt: Date.now(),
  })
}

/**
 * Тост владельцу: проверка отклонена (сокет business.rejected / inbox).
 * @param e событие с business {id,name,verification_notes}
 */
function handleBusinessRejected(e: { business?: { id?: number; name?: string; verification_notes?: string | null } }): void {
  const business = e?.business
  if (!business?.id) return
  if (isDuplicateEvent(`biz-rejected-${business.id}`)) return
  const reason = String(business.verification_notes ?? '').slice(0, 90)
  push({
    id: `biz-rejected-${business.id}-${Date.now()}`,
    type: 'business',
    icon: 'pi pi-times-circle',
    title: 'Проверка отклонена',
    body: reason || `${business.name ?? 'Бизнес'} — исправьте реквизиты и отправьте снова`.slice(0, 90),
    avatar: null,
    link: '/cabinet/onboarding',
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
      busOn('user:notification.created', recordInboxToast)
      busOn('user:business.verified', handleBusinessVerified)
      busOn('user:business.rejected', handleBusinessRejected)
      busOn('user:business.verification.submitted', handleBusinessSubmitted)
    }
    void pollToastUnreads()
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
    // Только свежие (как в poll-фолбэке): старые непрочитанные недельной
    // давности не должны всплывать как новые при каждом входе.
    const unread = (Array.isArray(rows) ? rows : [])
      .filter((n: any) => {
        if (!n || n?.read_at) return false
        const raw = n?.updated_at || n?.created_at
        const at = raw ? Date.parse(String(raw)) : NaN
        if (!Number.isFinite(at)) return false
        return Date.now() - at <= TOAST_FRESH_MS
      })
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
  try {
    window.addEventListener('upin:sw-push', handleSwPush)
  } catch {}
  subscribe()
  void showInitialUnreads()
  window.addEventListener('focus', subscribe)
  if (!toastPollTimer && typeof window !== 'undefined') {
    toastPollTimer = setInterval(() => void pollToastUnreads(), TOAST_POLL_MS)
  }
}
export function useAppNotifications() {
  captureAuthUid()
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
    // Пустая ссылка (например app.published): не уводим на корень,
    // просто гасим тост — полный текст уже в колокольчике.
    if (!t.link) {
      remove(t.id)
      return
    }
    router.visit(t.link); remove(t.id)
  }
  return { toasts, init, push, remove, openToast, subscribe }
}
