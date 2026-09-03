import { ref, onMounted, onBeforeUnmount } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { avatarSrcFor } from '@/composables/useAvatar'

export type AppToast = {
  id: string
  type: 'message' | 'friend'
  title: string
  body: string
  avatar: string | null
  link: string
  createdAt: number
}

const toasts = ref<AppToast[]>([])
let inited = false
let echoCh: any = null
let seenMsgIds = new Set<number>()
let timers = new Map<string, ReturnType<typeof setTimeout>>()

function getUid(): number {
  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
    return Number((window as any).userId || (usePage().props.auth as any)?.user?.id || 0)
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
  toasts.value = [t, ...toasts.value].slice(0, 3)
  playTick()
  const timer = setTimeout(() => remove(t.id), 5500)
  timers.set(t.id, timer)
  if ('vibrate' in navigator) try { (navigator as any).vibrate(120) } catch {}
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
function subscribe() {
  try {
    const echo = getEcho()
    if (!echo) return
    const uid = getUid()
    if (!uid) return
    if (echoCh) return
    echoCh = echo.private(`user.${uid}`)
    echoCh.listen('.message.sent', handleMessage)
    echoCh.listen('.friendship.updated', handleFriendship)
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
