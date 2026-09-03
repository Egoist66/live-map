import { ref, computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'

const isOpen = ref(false)
const conversations = ref<any[]>([])
const pending = ref<any[]>([])
const loading = ref(false)

async function fetchAll() {
  loading.value = true
  try {
    const w = window as any
    const convsPromise = w.__conversationsInflight ? w.__conversationsInflight : chatApi.conversations().catch(() => [] as any[])
    const [convs, fr] = await Promise.all([
      convsPromise,
      chatApi.friendships().catch(() => ({ pending_in: [] } as any)),
    ])
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
  const hasData = computed(() => conversations.value.length > 0 || pending.value.length > 0)
  const unreadCount = computed(() => conversations.value.reduce((s: number, c: any) => s + (c.unread_count || 0), 0))
  return { isOpen, conversations, pending, loading, hasData, unreadCount, fetchAll, open, close, goChat, goRequests, goFriends }
}
