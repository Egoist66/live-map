import { ref, computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { pinActivityApi, type PinActivityItem } from '@/services/pinActivity.api'
import { useBadgeStore } from '@/stores/badges'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

const activities = ref<PinActivityItem[]>([])
const unread = ref(0)
const loading = ref(false)
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
  try { await pinActivityApi.markRead() } catch { unread.value = prev }
}

async function markOne(a: PinActivityItem) {
  if (a.read_at) return
  a.read_at = new Date().toISOString()
  unread.value = Math.max(0, unread.value - 1)
  try { useBadgeStore().decActivity() } catch {}
  try { await pinActivityApi.markRead([a.id]) } catch {}
}

function describe(a: PinActivityItem): { emoji: string; text: string } {
  const name = a.actor?.name || 'Кто-то'
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

export function usePinActivity() {
  const hasData = computed(() => activities.value.length > 0)
  return { activities, unread, loading, hasData, describe, refresh, markAllRead, markOne, goPin, resolveTarget, init, subscribe }
}
