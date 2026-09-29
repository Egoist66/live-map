import { ref, computed } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { busOn } from '@/services/realtime-bus'

const isOpen = ref(false)
const conversations = ref<any[]>([])
const pending = ref<any[]>([])
const unreadChats = ref(0)
const loading = ref(false)
const tab = ref('events')
let dialogReadBound = false

function readIsAdmin(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin'
  } catch { return false }
}

async function fetchAll() {
  loading.value = true
  try {
    const w = window as any
    const convsPromise = w.__conversationsInflight ? w.__conversationsInflight : chatApi.conversations().catch(() => [] as any[])
    const [convs, fr] = await Promise.all([
      convsPromise,
      chatApi.friendships().catch(() => ({ pending_in: [] } as any)),
    ])
    unreadChats.value = (convs as any[]).filter((c: any) => Number(c.unread_count || 0) > 0).length
    conversations.value = (convs as any[]).slice(0, 8)
    pending.value = (fr.pending_in || []).slice(0, 8)
  } finally { loading.value = false }
}
function open() { isOpen.value = true; fetchAll() }
function close() { isOpen.value = false }
function goChat(id: number) { close(); router.visit(id ? `/chat/${id}` : '/chat') }
function goRequests() { close(); router.visit('/chat?tab=requests') }
function goFriends() { close(); router.visit('/chat?tab=friends') }

export function useBellNotifications() {
  ensureDialogReadSync()
  const hasData = computed(() => conversations.value.length > 0 || pending.value.length > 0)
  const unreadCount = computed(() => unreadChats.value)
  const isAdmin = computed(() => readIsAdmin())
  return { isOpen, conversations, pending, loading, tab, isAdmin, hasData, unreadCount, unreadChats, fetchAll, open, close, goChat, goRequests, goFriends }
}

/**
 * Разово подписаться на локальное прочтение диалогов.
 *
 * Колокольчик держит свой срез диалогов (топ-8): диалог, прочитанный
 * на странице /chat или в мини-окне, иначе висел бы с протухшей «1»
 * до следующего открытия модалки.
 */
function ensureDialogReadSync(): void {
  if (dialogReadBound) return
  dialogReadBound = true
  try {
    busOn('chat:dialog-read', (convId: number) => {
      const id = Number(convId)
      if (!(id > 0)) return
      const row = conversations.value.find((c: any) => Number(c?.id) === id)
      if (row && Number(row?.unread_count || 0) > 0) {
        row.unread_count = 0
        unreadChats.value = conversations.value.filter((c: any) => Number(c.unread_count || 0) > 0).length
      }
    })
  } catch {
    dialogReadBound = false
  }
}
