import { ref, computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { pinActivityApi, type PinActivityItem } from '@/services/pinActivity.api'
import { useBadgeStore } from '@/stores/badges'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

const activities = ref<PinActivityItem[]>([])
const unread = ref(0)
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

function subscribe() {
  try {
    const uid = getUid()
    if (!uid) return
    ensureUserChannel()
    if (busBound) return
    busBound = true
    busOn('user:pin.activity', onActivity)
    busOn('notify:activity', (e: any) => onActivity(e))
  } catch {}
}

async function refresh() {
  loading.value = true
  try {
    const [list, count] = await Promise.all([
      pinActivityApi.list().catch(() => []),
      pinActivityApi.unreadCount().catch(() => 0),
    ])
    activities.value = (list as PinActivityItem[]).slice(0, 30)
    unread.value = count as number
    try { useBadgeStore().setActivity(unread.value) } catch {}
  } finally {
    loading.value = false
  }
}

async function markAllRead() {
  if (!unread.value) return
  const prev = unread.value
  unread.value = 0
  activities.value = activities.value.map((a) => (a.read_at ? a : { ...a, read_at: new Date().toISOString() }))
  try { useBadgeStore().setActivity(0) } catch {}
  try { await pinActivityApi.markRead() } catch {
    unread.value = prev
    try { useBadgeStore().setActivity(prev) } catch {}
  }
}

async function markOne(a: PinActivityItem) {
  if (a.read_at) return
  a.read_at = new Date().toISOString()
  unread.value = Math.max(0, unread.value - 1)
  try { useBadgeStore().decActivity() } catch {}
  try { await pinActivityApi.markRead([a.id]) } catch {}
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
    await pinActivityApi.clear()
  } catch {
    activities.value = backup
    unread.value = prevUnread
    try { useBadgeStore().setActivity(prevUnread) } catch {}
  } finally {
    clearing.value = false
  }
}

/**
 * Виды, которые относятся строго к пинам/фото (вкладка «Пины»).
 * Остальное (ULove, UFlow, подписки на фото/уровень) — вкладка «События».
 */
export const PIN_ACTIVITY_KINDS = ['reaction', 'comment', 'mention', 'photo_comment', 'photo_like', 'sub_pin'] as const

/**
 * Проверка: активность относится к пинам, а не к общим событиям.
 * Mention с фото считаем пином, обычный mention без пина — событием.
 * @param a элемент ленты
 * @returns true если показать во вкладке «Пины»
 */
export function isPinActivity(a: PinActivityItem): boolean {
  if (a.kind === 'mention') {
    const hasPhoto = Number((a as any).photo?.id || (a as any).photo_id || 0) > 0
    const hasPin = Number((a as any).pin?.id || (a as any).pin_id || 0) > 0
    return hasPhoto || hasPin
  }
  return (PIN_ACTIVITY_KINDS as readonly string[]).includes(a.kind)
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
  if (a.kind === 'sub_pin') {
    const title = (a as any).excerpt || a.pin?.title || 'новый пин'
    return { emoji: '📍', text: `${name} создал пин «${title}»` }
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
  unread.value = 0
}

/**
 * Хук ленты уведомлений: пины + общие события (ULove, UFlow, подписки).
 * Разделяет ленту на вкладки «Пины» / «События», считает непрочитанные отдельно.
 * @returns состояние ленты и действия
 */
export function usePinActivity() {
  const hasData = computed(() => activities.value.length > 0)
  const pinActivities = computed(() => splitActivities(activities.value).pins)
  const eventActivities = computed(() => splitActivities(activities.value).events)
  const pinUnread = computed(() => pinActivities.value.filter((a) => !a.read_at).length)
  const eventUnread = computed(() => eventActivities.value.filter((a) => !a.read_at).length)
  const loveActivities = computed(() => eventActivities.value.filter((a) => a.kind === 'swipe_like' || a.kind === 'match'))
  const flowActivities = computed(() => eventActivities.value.filter((a) => a.kind === 'flow_like' || a.kind === 'flow_comment' || a.kind === 'flow_reply' || a.kind === 'flow_mention' || a.kind === 'sub_flow_post'))
  const subActivities = computed(() => eventActivities.value.filter((a) => a.kind === 'sub_photo' || a.kind === 'sub_level'))
  const loveUnread = computed(() => loveActivities.value.filter((a) => !a.read_at).length)
  const flowUnread = computed(() => flowActivities.value.filter((a) => !a.read_at).length)
  return { activities, unread, loading, clearing, hasData, pinActivities, eventActivities, pinUnread, eventUnread, loveActivities, flowActivities, subActivities, loveUnread, flowUnread, describe, refresh, markAllRead, markOne, clearAll, goPin, resolveTarget, init, subscribe }
}
