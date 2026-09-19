import { ref, computed } from 'vue'
import { router } from '@inertiajs/vue3'
import type { PinActivityItem } from '@/services/pinActivity.api'
import { notificationsApi, toActivityItem, describeInboxRow, type InboxNotification } from '@/services/notifications.api'
import { pinInvitesApi } from '@/services/pinInvites.api'
import { useFileDownload } from '@/composables/useFileDownload'
import { useBadgeStore } from '@/stores/badges'
import { useAppUpdates } from '@/composables/useAppUpdates'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

const activities = ref<PinActivityItem[]>([])
const inboxRows = ref<InboxNotification[]>([])
const unread = ref(0)
const pinUnreadCount = ref(0)
const eventUnreadCount = ref(0)
const loading = ref(false)
const clearing = ref(false)
let busBound = false
let inited = false

const REACTION_EMOJI: Record<string, string> = {
  like: '❤️',
  fire: '🔥',
  laugh: '😂',
  sad: '😢',
  angry: '😡',
  useful: '👍',
}

function getUid(): number {
  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
  } catch {}
  return Number((window as any).userId || 0)
}

function onActivity(e: any) {
  const act = e?.activity
  if (!act?.id) return
  const uid = getUid()
  if (act.owner_id && uid && Number(act.owner_id) !== uid) return
  const idx = activities.value.findIndex((x) => x.id === act.id)
  if (idx >= 0) {
    const rest = activities.value.filter((x) => x.id !== act.id)
    activities.value = [act, ...rest].slice(0, 30)
    return
  }
  activities.value = [act, ...activities.value].slice(0, 30)
  unread.value += 1
  try { useBadgeStore().incActivity() } catch {}
}

/**
 * Новая строка inbox (сокет или поллер) — в начало ленты без дублей.
 * Прочитанные строки счётчик не трогают: тост и +1 только для unread.
 */
function onNotification(e: any) {
  const row = e?.notification as InboxNotification | undefined
  if (!row?.id) return
  if (row.read_at) return
  try {
    if (!inboxRows.value.some((x) => x.id === row.id)) inboxRows.value = [row, ...inboxRows.value].slice(0, 30)
    onActivity({ activity: toActivityItem(row) })
  } catch {}
}

function subscribe() {
  try {
    const uid = getUid()
    if (!uid) return
    ensureUserChannel()
    if (busBound) return
    busBound = true
    busOn('user:notification.created', onNotification)
  } catch {}
}

async function refresh() {
  loading.value = true
  try {
    const [rows, count] = await Promise.all([
      notificationsApi.list().catch(() => []),
      notificationsApi.unreadCount().catch(() => ({ total: 0, pins: 0, events: 0 })),
    ])
    inboxRows.value = (rows as InboxNotification[]).slice(0, 30)
    activities.value = inboxRows.value.map((row) => toActivityItem(row))
    unread.value = count.total
    pinUnreadCount.value = count.pins
    eventUnreadCount.value = count.events
    try { useBadgeStore().setActivity(unread.value) } catch {}
  } finally {
    loading.value = false
  }
}

async function markAllRead() {
  if (!unread.value) return
  const prev = unread.value
  unread.value = 0
  pinUnreadCount.value = 0
  eventUnreadCount.value = 0
  activities.value = activities.value.map((a) => (a.read_at ? a : { ...a, read_at: new Date().toISOString() }))
  inboxRows.value = inboxRows.value.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() }))
  try { useBadgeStore().setActivity(0) } catch {}
  try { await notificationsApi.markRead() } catch {
    unread.value = prev
    try { useBadgeStore().setActivity(prev) } catch {}
  }
}

async function markOne(a: PinActivityItem) {
  if (a.read_at) return
  a.read_at = new Date().toISOString()
  unread.value = Math.max(0, unread.value - 1)
  try { useBadgeStore().decActivity() } catch {}
  try {
    await notificationsApi.markRead([String(a.id)])
  } catch {}
}

/**
 * Достать id пина из активности приглашения.
 * @param a элемент ленты kind=invite
 * @returns id пина или 0
 */
function invitePinId(a: PinActivityItem): number {
  const pinId = Number((a as any).pin?.id || (a as any).pin_id || 0)
  return Number.isFinite(pinId) ? pinId : 0
}

/**
 * Принять приглашение в пин: сервер ставит accepted и шлёт автору уведомление.
 * Локально помечаем строку прочитанной и гасим счётчики, бэк уже пометил read.
 * @param a элемент ленты kind=invite
 */
async function acceptInvite(a: PinActivityItem): Promise<void> {
  const pinId = invitePinId(a)
  if (!pinId) return
  try {
    await pinInvitesApi.accept(pinId)
  } catch {
    return
  }
  if (!a.read_at) {
    a.read_at = new Date().toISOString()
    unread.value = Math.max(0, unread.value - 1)
    try { useBadgeStore().decActivity() } catch {}
  }
  const row = inboxRows.value.find((n) => String(n.id) === String(a.id))
  if (row && !row.read_at) row.read_at = a.read_at ?? new Date().toISOString()
}

/**
 * Отклонить приглашение в пин: сервер удаляет invite, уведомление гаснет.
 * @param a элемент ленты kind=invite
 */
async function declineInvite(a: PinActivityItem): Promise<void> {
  const pinId = invitePinId(a)
  if (!pinId) return
  try {
    await pinInvitesApi.decline(pinId)
  } catch {
    return
  }
  if (!a.read_at) {
    a.read_at = new Date().toISOString()
    unread.value = Math.max(0, unread.value - 1)
    try { useBadgeStore().decActivity() } catch {}
  }
  const row = inboxRows.value.find((n) => String(n.id) === String(a.id))
  if (row && !row.read_at) row.read_at = a.read_at ?? new Date().toISOString()
}

/**
 * Достать id района из строки приглашения district.invited.
 * @param n строка inbox
 * @returns id района или 0
 */
function inviteDistrictId(n: InboxNotification): number {
  const id = Number((n.data as any)?.district?.id || 0)
  return Number.isFinite(id) ? id : 0
}

/**
 * Принять приглашение в район из уведомлений: сервер ставит approved,
 * открывает пины и чат. Строку помечаем прочитанной и гасим счётчики.
 * @param n строка inbox типа district.invited
 */
async function acceptDistrictInvite(n: InboxNotification): Promise<void> {
  const districtId = inviteDistrictId(n)
  if (!districtId) return
  try {
    const { districtsApi } = await import('@/services/districts.api')
    await districtsApi.acceptInvite(districtId)
  } catch {
    return
  }
  markInboxRead(n)
}

/**
 * Отклонить приглашение в район из уведомлений (тихо).
 * @param n строка inbox типа district.invited
 */
async function declineDistrictInvite(n: InboxNotification): Promise<void> {
  const districtId = inviteDistrictId(n)
  if (!districtId) return
  try {
    const { districtsApi } = await import('@/services/districts.api')
    await districtsApi.declineInvite(districtId)
  } catch {
    return
  }
  markInboxRead(n)
}

/**
 * Локально погасить строку inbox и счётчики после accept/decline.
 * @param n строка inbox
 */
function markInboxRead(n: InboxNotification): void {
  if (!n.read_at) {
    n.read_at = new Date().toISOString()
    unread.value = Math.max(0, unread.value - 1)
    try { useBadgeStore().decActivity() } catch {}
  }
  const item = activities.value.find((a) => String(a.id) === n.id)
  if (item && !item.read_at) item.read_at = n.read_at
  try {
    void notificationsApi.markRead([n.id])
  } catch {}
}
/**
 * Удалить всю ленту активности навсегда.
 * Подтверждение — на вызывающей стороне (useAppConfirm в setup-скоупе).
 */
async function clearAll(): Promise<void> {
  if (clearing.value) return
  clearing.value = true
  const backup = activities.value
  const prevUnread = unread.value
  activities.value = []
  unread.value = 0
  try { useBadgeStore().setActivity(0) } catch {}
  try {
    await notificationsApi.clear()
    inboxRows.value = []
  } catch {
    activities.value = backup
    unread.value = prevUnread
    try { useBadgeStore().setActivity(prevUnread) } catch {}
  } finally {
    clearing.value = false
  }
}

/**
 * Виды строго про пины карты (вкладка «Пины»).
 * Галерея (photo_like, photo_comment, mention с фото) — вкладка «События».
 */
export const PIN_ACTIVITY_KINDS = ['reaction', 'comment', 'mention', 'sub_pin', 'scheduled_published', 'invite', 'invite_accepted'] as const

/**
 * Виды галереи фото (вкладка «События», секция «Фото»).
 */
export const PHOTO_ACTIVITY_KINDS = ['photo_like', 'photo_comment'] as const

/**
 * Проверка: активность относится к пинам, а не к общим событиям.
 * Mention только с пином считаем пином, mention с фото — событием.
 * @param a элемент ленты
 * @returns true если показать во вкладке «Пины»
 */
export function isPinActivity(a: PinActivityItem): boolean {
  if (a.kind === 'mention') {
    const hasPin = Number((a as any).pin?.id || (a as any).pin_id || 0) > 0
    return hasPin
  }
  return (PIN_ACTIVITY_KINDS as readonly string[]).includes(a.kind)
}

/**
 * Проверка: активность относится к галерее фото.
 * @param a элемент ленты
 * @returns true если это лайк/коммент фото или упоминание с фото
 */
export function isPhotoActivity(a: PinActivityItem): boolean {
  if ((PHOTO_ACTIVITY_KINDS as readonly string[]).includes(a.kind)) return true
  if (a.kind === 'mention') {
    const hasPhoto = Number((a as any).photo?.id || (a as any).photo_id || 0) > 0
    return hasPhoto
  }
  return false
}

/**
 * Короткая группировка ленты для вкладок «Пины» / «События».
 */
export function splitActivities(list: PinActivityItem[]): { pins: PinActivityItem[]; events: PinActivityItem[] } {
  const pins: PinActivityItem[] = []
  const events: PinActivityItem[] = []
  for (const a of list) {
    if (isPinActivity(a)) pins.push(a)
    else events.push(a)
  }
  return { pins, events }
}

function describe(a: PinActivityItem): { emoji: string; text: string } {
  const name = a.actor?.name || 'Кто-то'
  if (a.kind === 'swipe_like') {
    return (a as any).is_incognito
      ? { emoji: '💘', text: 'Тайный поклонник лайкнул вас в ULove' }
      : { emoji: '💘', text: `${name} лайкнул вас в ULove` }
  }
  if (a.kind === 'match') {
    return { emoji: '💞', text: `${name} — у вас мэтч в ULove!` }
  }
  if (a.kind === 'photo_like') {
    return { emoji: '❤️', text: `${name} лайкнул ваше фото` }
  }
  if (a.kind === 'sub_flow_post') {
    const excerpt = (a as unknown as { excerpt?: string }).excerpt
    return { emoji: '📰', text: excerpt ? `${name} опубликовал в UFlow: ${excerpt}` : `${name} опубликовал пост в UFlow` }
  }
  if (a.kind === 'flow_like') {
    return { emoji: '❤️', text: `${name} оценил ваш пост в UFlow` }
  }
  if (a.kind === 'flow_comment') {
    const excerpt = (a as unknown as { excerpt?: string }).excerpt
    return { emoji: '💬', text: excerpt ? `${name}: ${excerpt}` : `${name} прокомментировал ваш пост` }
  }
  if (a.kind === 'flow_reply') {
    const excerpt = (a as unknown as { excerpt?: string }).excerpt
    return { emoji: '↩️', text: excerpt ? `${name} ответил вам: ${excerpt}` : `${name} ответил на ваш комментарий` }
  }
  if (a.kind === 'flow_mention') {
    const excerpt = (a as unknown as { excerpt?: string }).excerpt
    return { emoji: '📣', text: excerpt ? `${name} упомянул вас в UFlow: ${excerpt}` : `${name} упомянул вас в UFlow` }
  }
  if (a.kind === 'flow_repost') {
    const excerpt = (a as unknown as { excerpt?: string }).excerpt
    return { emoji: '🔁', text: excerpt ? `${name} репостнул с цитатой: ${excerpt}` : `${name} поделился вашим постом в UFlow` }
  }
  if (a.kind === 'sub_pin') {
    const title = (a as any).excerpt || a.pin?.title || 'новый пин'
    return { emoji: '📍', text: `${name} создал пин «${title}»` }
  }
  if (a.kind === 'scheduled_published') {
    const title = (a as any).excerpt || a.pin?.title || 'пин'
    return { emoji: '🕓', text: `Ваш запланированный пин «${title}» опубликован` }
  }
  if (a.kind === 'invite') {
    const title = a.pin?.title || 'пин'
    return { emoji: '🎫', text: `${name} приглашает в пин «${title}»` }
  }
  if (a.kind === 'invite_accepted') {
    const title = a.pin?.title || 'пин'
    return { emoji: '✅', text: `${name} принял приглашение в «${title}»` }
  }
  if (a.kind === 'sub_photo') {
    return { emoji: '📷', text: `${name} добавил новое фото` }
  }
  if (a.kind === 'sub_level') {
    return { emoji: '⭐', text: (a as any).excerpt ? `${name}: ${(a as any).excerpt}` : `${name} обновил репутацию` }
  }
  if (a.kind === 'mention') {
    return a.photo
      ? { emoji: '📣', text: a.excerpt ? `${name} упомянул вас: ${a.excerpt}` : `${name} упомянул вас в фото` }
      : { emoji: '📣', text: a.excerpt ? `${name} упомянул вас: ${a.excerpt}` : `${name} упомянул вас` }
  }
  if (a.kind === 'photo_comment') {
    return { emoji: '📷', text: a.excerpt ? `${name}: ${a.excerpt}` : `${name} прокомментировал фото` }
  }
  if (a.kind === 'comment') {
    return { emoji: '💬', text: a.excerpt ? `${name}: ${a.excerpt}` : `${name} прокомментировал пин` }
  }
  const emoji = REACTION_EMOJI[a.reaction_type || ''] || '⭐'
  return { emoji, text: `${name} отреагировал ${emoji}` }
}

function resolveTarget(a: PinActivityItem): { url: string; pending: any } {
  const actorId = Number((a as unknown as { actor?: { id?: number } }).actor?.id || 0) || null
  if (a.kind === 'swipe_like') {
    return { url: '/swipes?tab=admirers', pending: null }
  }
  if (a.kind === 'match') {
    return { url: '/swipes', pending: null }
  }
  const flowPostId = Number((a as unknown as { flow_post?: { id?: number }; flow_post_id?: number }).flow_post?.id || (a as unknown as { flow_post_id?: number }).flow_post_id || 0) || null
  if (flowPostId) {
    return { url: `/flow/post/${flowPostId}`, pending: { type: 'flow', postId: flowPostId } }
  }
  const pinId = Number((a as any).pin?.id || (a as any).pin_id || 0) || null
  const commentId = Number((a as any).comment_id || 0) || null
  const photoId = Number((a as any).photo?.id || (a as any).photo_id || 0) || null
  const photoCommentId = Number((a as any).photo_comment_id || 0) || null
  const photoUserId = Number((a as any).photo?.user_id || actorId || 0) || null
  if (pinId) {
    const url = `/map?pin=${pinId}${commentId ? `&comment=${commentId}` : ''}`
    return { url, pending: { type: 'pin', pinId, commentId } }
  }
  if (photoId && photoUserId) {
    const url = `/users/${photoUserId}?photo=${photoId}${photoCommentId ? `&comment=${photoCommentId}` : ''}`
    return { url, pending: { type: 'photo', photoId, commentId: photoCommentId, userId: photoUserId } }
  }
  if (actorId) {
    return { url: `/users/${actorId}`, pending: null }
  }
  return { url: '/map', pending: null }
}

function goPin(a: PinActivityItem) {
  void markOne(a)
  const { url, pending } = resolveTarget(a)
  try {
    if (pending) sessionStorage.setItem('live-map:pending-activity', JSON.stringify(pending))
  } catch {}
  router.visit(url)
}

function init() {
  if (inited) return
  inited = true
  void refresh()
  subscribe()
  window.addEventListener('focus', subscribe)
}

/**
 * Сбросить ленту активности при смене аккаунта.
 */
export function resetPinActivity(): void {
  try {
    leaveUserChannel()
  } catch {}
  inited = false
  activities.value = []
  inboxRows.value = []
  unread.value = 0
  pinUnreadCount.value = 0
  eventUnreadCount.value = 0
}

/**
 * Хук ленты уведомлений: пины + общие события (ULove, UFlow, подписки).
 * Разделяет ленту на вкладки «Пины» / «События», считает непрочитанные отдельно.
 * @returns состояние ленты и действия
 */
/**
 * Строки inbox без activity-тела (дружба, жалобы, безопасность, новости) —
 * отдельная секция «Уведомления» в табе «События».
 */
export function usePinActivity() {
  const hasData = computed(() => activities.value.length > 0)
  const otherNotifications = computed(() => inboxRows.value.filter((n) => !n.data?.activity))
  const otherUnread = computed(() => otherNotifications.value.filter((n) => !n.read_at).length)

  /**
   * Открыть строку inbox: пометить прочитанной и перейти по ссылке типа.
   * Новости открываются превью в модалке обновлений.
   */
  async function goNotification(n: InboxNotification) {
    if (!n.read_at) {
      n.read_at = new Date().toISOString()
      unread.value = Math.max(0, unread.value - 1)
      try { useBadgeStore().decActivity() } catch {}
      try { await notificationsApi.markRead([n.id]) } catch {}
      const item = activities.value.find((a) => String(a.id) === n.id)
      if (item) item.read_at = n.read_at
    }
    if (n.type === 'app.published' && n.data?.update) {
      try { useAppUpdates().preview(n.data.update as any) } catch {}
      return
    }
    const desc = describeInboxRow(n)
    if (desc.downloadUrl) {
      try { await useFileDownload().download(desc.downloadUrl, desc.fileName || 'SOS-чат.txt') } catch {}
      return
    }
    const link = desc.link
    if (link) router.visit(link)
  }
  const pinActivities = computed(() => splitActivities(activities.value).pins)
  const eventActivities = computed(() => splitActivities(activities.value).events)
  const pinUnread = computed(() => pinUnreadCount.value)
  const eventUnread = computed(() => eventUnreadCount.value)
  const loveActivities = computed(() => eventActivities.value.filter((a) => a.kind === 'swipe_like' || a.kind === 'match'))
  const flowActivities = computed(() => eventActivities.value.filter((a) => a.kind === 'flow_like' || a.kind === 'flow_comment' || a.kind === 'flow_reply' || a.kind === 'flow_mention' || a.kind === 'flow_repost' || a.kind === 'sub_flow_post'))
  const subActivities = computed(() => eventActivities.value.filter((a) => a.kind === 'sub_photo' || a.kind === 'sub_level'))
  const photoActivities = computed(() => eventActivities.value.filter((a) => isPhotoActivity(a)))
  const loveUnread = computed(() => loveActivities.value.filter((a) => !a.read_at).length)
  const flowUnread = computed(() => flowActivities.value.filter((a) => !a.read_at).length)
  const photoUnread = computed(() => photoActivities.value.filter((a) => !a.read_at).length)
  return { activities, unread, loading, clearing, hasData, pinActivities, eventActivities, pinUnread, eventUnread, loveActivities, flowActivities, subActivities, photoActivities, loveUnread, flowUnread, photoUnread, otherNotifications, otherUnread, describe, refresh, markAllRead, markOne, clearAll, goPin, goNotification, resolveTarget, acceptInvite, declineInvite, invitePinId, acceptDistrictInvite, declineDistrictInvite, init, subscribe }
}
