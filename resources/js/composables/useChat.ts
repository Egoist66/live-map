import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import type { Conversation, ConversationDetail, Message } from '@/types/entities/Chat'

export function useChat() {
  const conversations = ref<Conversation[]>([])
  const activeConv = ref<ConversationDetail | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const refreshing = ref(false)
  const typingUsers = ref<Set<number>>(new Set())
  const searchQuery = ref('')
  const searchResults = ref<any[]>([])
  const searching = ref(false)
  const selectedId = ref<number | null>(null)
  const error = ref<string | null>(null)
  const editingId = ref<number | null>(null)
  const editingBody = ref('')
  let echoChannels: any[] = []
  let activeChatChannel: any = null
  let activeChatId: number | null = null
  const seenIds = new Set<number>()
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let typingThrottleUntil = 0
  const typingExpire = new Map<number, ReturnType<typeof setTimeout>>()

  const unreadTotal = computed(() => conversations.value.reduce((s, c) => s + c.unread_count, 0))

  function getEcho(): any {
    return (window as any).Echo
  }
  function getUid(): number {
    try {
      const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (meta) return Number(meta)
      return Number((window as any).userId || (usePage().props.auth as any)?.user?.id || 0)
    } catch { return Number((window as any).userId || 0) }
  }
  function currentChannel(): any {
    const echo = getEcho()
    if (!echo || !selectedId.value) return null
    try { return echo.private(`chat.${selectedId.value}`) } catch { return null }
  }

  async function loadConversations() { conversations.value = await chatApi.conversations() }

  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      await loadConversations()
      if (selectedId.value) {
        const d = await chatApi.getConversation(selectedId.value)
        activeConv.value = d
        messages.value = d.messages
        await nextTick()
        scrollToBottom()
      }
    } finally { refreshing.value = false }
  }

  async function openConversation(id: number) {
    selectedId.value = id
    typingUsers.value = new Set()
    typingExpire.forEach((t) => clearTimeout(t))
    typingExpire.clear()
    loading.value = true
    try {
      const d = await chatApi.getConversation(id)
      activeConv.value = d
      messages.value = d.messages
      d.messages.forEach((m:any)=> seenIds.add(m.id))
      chatApi.markRead(id).catch(()=>{})
      const conv = conversations.value.find((c) => c.id === id)
      if (conv) conv.unread_count = 0
      subscribeChat(id)
      await nextTick()
      scrollToBottom()
    } finally { loading.value = false }
  }

  async function createConversation(userId: number, initialMessage?: string) {
    error.value = null
    try {
      const res = await chatApi.createConversation(userId, initialMessage)
      await loadConversations()
      await openConversation(res.id)
      return res
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.message || 'Не удалось создать чат'
      throw e
    }
  }

  async function sendMessage(body: string) {
    if (!selectedId.value || !body.trim()) return
    if (sending.value) return
    const text = body.trim()
    const tempId = -Math.floor(Math.random()*1e9) - Date.now()%1e6
    const uid = getUid()
    sendTypingWs(false)
    if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null }
    const optimistic: any = { id: tempId, conversation_id: selectedId.value, sender_id: uid, body: text, type: 'text', created_at: new Date().toISOString(), pending: true }
    messages.value.push(optimistic)
    seenIds.add(tempId)
    scrollToBottom()
    sending.value = true
    try {
      const msg = await chatApi.sendMessage(selectedId.value!, text)
      seenIds.add(msg.id)
      const tempIdx = messages.value.findIndex((m) => m.id === tempId)
      const existsIdx = messages.value.findIndex((m) => m.id === msg.id)
      if (tempIdx !== -1 && existsIdx !== -1) {
        messages.value.splice(tempIdx, 1)
        const real = messages.value.find((x)=> x.id===msg.id) as any
        if (real) real.justSent = true
      } else if (tempIdx !== -1) {
        (messages.value[tempIdx] as any) = { ...(msg as any), justSent: true }
      } else if (existsIdx === -1) {
        if (!seenIds.has(msg.id) || !messages.value.some(m=>m.id===msg.id)) messages.value.push({ ...(msg as any), justSent: true } as any)
      }
      const conv = conversations.value.find((c) => c.id === selectedId.value)
      if (conv) { conv.last_message = msg; conv.last_message_at = msg.created_at }
      scrollToBottom()
      setTimeout(() => { const m = messages.value.find((x) => x.id === msg.id) as any; if (m) m.justSent = false }, 600)
    } catch (e: any) {
      const idx = messages.value.findIndex((m) => m.id === tempId)
      if (idx !== -1) (messages.value[idx] as any).failed = true
      throw e
    } finally { sending.value = false }
  }

  function startEdit(msg: Message) {
    if (msg.sender_id !== getUid()) return
    editingId.value = msg.id
    editingBody.value = msg.body
  }
  function cancelEdit() {
    editingId.value = null
    editingBody.value = ''
  }
  async function saveEdit() {
    if (editingId.value === null || !editingBody.value.trim()) return
    const id = editingId.value
    const body = editingBody.value.trim()
    const idx = messages.value.findIndex((m) => m.id === id)
    if (idx !== -1) (messages.value[idx] as any).pending = true
    try {
      const updated = await chatApi.editMessage(id, body)
      const i = messages.value.findIndex((m) => m.id === id)
      if (i !== -1) messages.value[i] = updated
      const conv = conversations.value.find((c) => c.id === updated.conversation_id)
      if (conv && conv.last_message?.id === id) conv.last_message = updated
      cancelEdit()
    } catch (e) {
      if (idx !== -1) (messages.value[idx] as any).pending = false
      throw e
    }
  }

  async function deleteMessage(id: number) {
    await chatApi.deleteMessage(id)
    messages.value = messages.value.filter((m) => m.id !== id)
    const conv = conversations.value.find((c) => (c as any).last_message?.id === id)
    if (conv) await loadConversations()
  }

  async function deleteConversation(id: number) {
    await chatApi.deleteConversation(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (selectedId.value === id) { selectedId.value = null; activeConv.value = null; messages.value = [] }
  }

  function scrollToBottom() {
    nextTick(() => {
      const el = document.getElementById('chat-messages')
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  function handleIncoming(msg: Message) {
    if (seenIds.has(msg.id) && messages.value.some(m=>m.id===msg.id)) return
    seenIds.add(msg.id)
    if (msg.conversation_id === selectedId.value) {
      const pendingIdx = messages.value.findIndex((m:any)=> m.pending && m.conversation_id===msg.conversation_id && m.sender_id===msg.sender_id)
      if (pendingIdx !== -1) {
        const bodyMatch = messages.value.findIndex((m:any)=> m.pending && (m as any).body===msg.body && m.sender_id===msg.sender_id)
        const target = bodyMatch !== -1 ? bodyMatch : pendingIdx
        if (messages.value.some(m=>m.id===msg.id)) {
          messages.value.splice(target,1)
        } else {
          (messages.value as any)[target] = msg
        }
      } else {
        if (!messages.value.some((m) => m.id === msg.id)) messages.value.push(msg)
      }
      const n = new Set(typingUsers.value); n.delete(msg.sender_id); typingUsers.value = n
      const t = typingExpire.get(msg.sender_id); if (t) { clearTimeout(t); typingExpire.delete(msg.sender_id) }
      chatApi.markRead(msg.conversation_id).catch(()=>{})
      scrollToBottom()
    } else {
      const conv = conversations.value.find((c) => c.id === msg.conversation_id)
      if (conv) { conv.unread_count = (conv.unread_count || 0) + 1; conv.last_message = msg; conv.last_message_at = msg.created_at }
      else loadConversations()
    }
  }

  function subscribeGlobal() {
    try {
      const echo = getEcho()
      if (!echo) return
      const uid = getUid() || document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (uid) {
        const ch = echo.private(`user.${uid}`)
        ch.listen('.message.sent', (e: any) => handleIncoming(e.message))
        ch.listen('.friendship.updated', () => {})
        echoChannels.push(ch)
      }
    } catch {}
  }

  function handleUpdated(msg: Message) {
    const idx = messages.value.findIndex((m) => m.id === msg.id)
    if (idx !== -1) messages.value[idx] = msg
    const conv = conversations.value.find((c) => c.id === msg.conversation_id)
    if (conv && conv.last_message?.id === msg.id) conv.last_message = msg
  }

  function subscribeChat(convId: number) {
    try {
      const echo = getEcho()
      if (!echo) return
      const currentUserId = getUid()
      if (activeChatChannel && activeChatId !== null && activeChatId !== convId) {
        try { echo.leave(`chat.${activeChatId}`) } catch {}
        echoChannels = echoChannels.filter((c:any)=> c!==activeChatChannel)
        activeChatChannel = null
      }
      if (activeChatChannel && activeChatId === convId) return
      const ch = echo.private(`chat.${convId}`)
      activeChatChannel = ch
      activeChatId = convId
      ch.listen('.message.sent', (e: any) => handleIncoming(e.message))
      ch.listen('.message.updated', (e: any) => handleUpdated(e.message))
      const handleTyping = (e: any) => {
        if (Number(e.user_id) === currentUserId) return
        if (e.is_typing) {
          const n = new Set(typingUsers.value); n.add(Number(e.user_id)); typingUsers.value = n
          const prev = typingExpire.get(Number(e.user_id)); if (prev) clearTimeout(prev)
          const timer = setTimeout(() => {
            const nn = new Set(typingUsers.value); nn.delete(Number(e.user_id)); typingUsers.value = nn
            typingExpire.delete(Number(e.user_id))
          }, 2500)
          typingExpire.set(Number(e.user_id), timer)
        } else {
          const n = new Set(typingUsers.value); n.delete(Number(e.user_id)); typingUsers.value = n
          const t = typingExpire.get(Number(e.user_id)); if (t) { clearTimeout(t); typingExpire.delete(Number(e.user_id)) }
        }
      }
      ch.listenForWhisper('typing', handleTyping)
      ch.listen('.message.read', (e: any) => {
        const n = new Set(typingUsers.value); n.delete(Number(e.user_id)); typingUsers.value = n
      })
      echoChannels.push(ch)
    } catch {}
  }

  async function searchUsers() {
    if (searchQuery.value.length < 2) { searchResults.value = []; return }
    searching.value = true
    try { searchResults.value = await chatApi.search(searchQuery.value) } finally { searching.value = false }
  }

  watch(searchQuery, () => searchUsers())

  function sendTypingWs(isTyping: boolean) {
    if (!selectedId.value) return
    try {
      const ch = currentChannel()
      if (!ch) return
      ch.whisper('typing', { user_id: getUid(), is_typing: isTyping })
    } catch {}
  }

  function notifyTyping() {
    if (!selectedId.value) return
    const now = Date.now()
    if (now < typingThrottleUntil) {
      if (typingTimeout) clearTimeout(typingTimeout)
      typingTimeout = setTimeout(() => sendTypingWs(false), 1200)
      return
    }
    typingThrottleUntil = now + 700
    sendTypingWs(true)
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => sendTypingWs(false), 1200)
  }

  function stopTyping() {
    if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null }
    sendTypingWs(false)
  }

  onMounted(() => { loadConversations(); subscribeGlobal() })
  onBeforeUnmount(() => {
    if (typingTimeout) clearTimeout(typingTimeout)
    typingExpire.forEach((t) => clearTimeout(t))
    try {
      const echo = getEcho()
      echoChannels.forEach((c: any) => { try { echo.leave(c.name ?? `chat.${selectedId.value}`) } catch {} })
    } catch {}
  })

  return {
    conversations, activeConv, messages, loading, sending, refreshing, typingUsers,
    searchQuery, searchResults, searching, selectedId, error, unreadTotal,
    editingId, editingBody,
    loadConversations, refresh, openConversation, createConversation, sendMessage, startEdit, cancelEdit, saveEdit, deleteMessage, deleteConversation, searchUsers, notifyTyping, stopTyping, handleIncoming, handleUpdated,
  }
}
