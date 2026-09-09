import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { chatApi } from '@/services/chat.api'
import type { Conversation, ConversationDetail, Message } from '@/types/entities/Chat'

let searchAbort: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let loadConversationsInflight: Promise<Conversation[]> | null = null
let scrollRaf: number | null = null

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
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  function notifyBlocked(detail?: string) {
    const msg = detail || 'Пользователь заблокировал вас'
    const isBlockedBy = msg.includes('заблокировал вас')
    toast?.add({
      severity: 'error',
      summary: isBlockedBy ? '⛔ Пользователь заблокировал вас' : '⛔ Нельзя отправить',
      detail: isBlockedBy ? 'Вы не можете писать этому пользователю — он ограничил сообщения для вас.' : msg,
      life: 4200,
    })
  }
  let echoChannels: any[] = []
  let activeChatChannel: any = null
  let activeChatId: number | null = null
  let alive = true
  const seenIds = new Set<number>()
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let typingThrottleUntil = 0
  const typingExpire = new Map<number, ReturnType<typeof setTimeout>>()

  const unreadTotal = computed(() => conversations.value.filter((c) => Number(c.unread_count || 0) > 0).length)
  const unreadMessagesTotal = computed(() => conversations.value.reduce((s, c) => s + (Number(c.unread_count) || 0), 0))

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
  function isChatPageOpen(): boolean {
    try {
      if (document.hidden) return false
      const ziggyRoute = (window as any).route ?? (globalThis as any).route
      if (typeof ziggyRoute !== 'function') return true
      return !!ziggyRoute().current('chat')
    } catch { return true }
  }
  function currentChannel(): any {
    const echo = getEcho()
    if (!echo || !selectedId.value) return null
    try { return echo.private(`chat.${selectedId.value}`) } catch { return null }
  }

  function sortConversations() {
    conversations.value = [...conversations.value].sort((a:any,b:any)=> new Date(b.last_message_at||b.updated_at||0).getTime() - new Date(a.last_message_at||a.updated_at||0).getTime())
  }
  function bumpConversation(msg: any) {
    const idx = conversations.value.findIndex((c) => c.id === msg.conversation_id)
    if (idx === -1) { loadConversations(); return }
    const conv: any = conversations.value[idx]
    conv.last_message = msg
    conv.last_message_at = msg.created_at
    conversations.value = [conv, ...conversations.value.filter((c) => c.id !== msg.conversation_id)]
  }
  function syncConversationPreview(msg: any) {
    bumpConversation(msg)
  }
  async function loadConversations() {
    const w = window as any
    if (loadConversationsInflight) return loadConversationsInflight.then(d => { conversations.value = d; return d })
    if (w.__conversationsInflight) return w.__conversationsInflight.then((d: Conversation[]) => { conversations.value = d; return d })
    loadConversationsInflight = chatApi.conversations() as Promise<Conversation[]>
    w.__conversationsInflight = loadConversationsInflight
    try {
      const data = await loadConversationsInflight
      conversations.value = data
      return data
    } finally { loadConversationsInflight = null; w.__conversationsInflight = null }
  }

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
    if (selectedId.value === id && activeConv.value?.id === id && !loading.value) return
    selectedId.value = id
    const cached = conversations.value.find((c) => c.id === id) as any
    if (cached?.other) {
      activeConv.value = { id, other: cached.other, participants: [] } as any
      if (cached.last_message) messages.value = [cached.last_message as any]
      else messages.value = []
    } else {
      activeConv.value = null
      messages.value = []
    }
    typingUsers.value = new Set()
    typingExpire.forEach((t) => clearTimeout(t))
    typingExpire.clear()
    loading.value = true
    try {
      const d = await chatApi.getConversation(id)
      if (selectedId.value !== id) return
      activeConv.value = d
      messages.value = d.messages
      d.messages.forEach((m:any)=> seenIds.add(m.id))
      const last = d.messages[d.messages.length - 1] as any
      const conv = conversations.value.find((c) => c.id === id)
      if (conv) {
        conv.unread_count = 0
        if (last) bumpConversation(last)
      } else if (last) {
        loadConversations()
      }
      try { await chatApi.markRead(id) } catch {}
      subscribeChat(id)
      await nextTick()
      scrollToBottom()
    } catch (e) {
      if (selectedId.value === id) { selectedId.value = null; activeConv.value = null; messages.value = []; loading.value = false }
      throw e
    } finally { if (selectedId.value === id) loading.value = false }
  }

  async function createConversation(userId: number, initialMessage?: string) {
    error.value = null
    try {
      const res = await chatApi.createConversation(userId, initialMessage)
      await loadConversations()
      await openConversation(res.id)
      return res
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Не удалось создать чат'
      error.value = msg
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
      syncConversationPreview(msg)
      scrollToBottom()
      setTimeout(() => { const m = messages.value.find((x) => x.id === msg.id) as any; if (m) m.justSent = false }, 600)
    } catch (e: any) {
      const idx = messages.value.findIndex((m) => m.id === tempId)
      if (idx !== -1) (messages.value[idx] as any).failed = true
      const msg = e?.response?.data?.message || ''
      if (e?.response?.status === 403 && msg.includes('заблокировал')) {
        if (idx !== -1) messages.value.splice(idx, 1)
      }
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
      if (conv && (conv as any).last_message?.id === id) { (conv as any).last_message = updated; sortConversations() }
      cancelEdit()
    } catch (e) {
      if (idx !== -1) (messages.value[idx] as any).pending = false
      throw e
    }
  }

  async function deleteMessage(id: number) {
    const backup = [...messages.value]
    messages.value = messages.value.filter((m) => m.id !== id)
    try {
      await chatApi.deleteMessage(id)
      const conv = conversations.value.find((c) => (c as any).last_message?.id === id)
      if (conv) loadConversations()
    } catch (e) { messages.value = backup; throw e }
  }

  async function deleteConversation(id: number) {
    const backup = [...conversations.value]
    const wasSelected = selectedId.value === id
    const backupActive = activeConv.value
    const backupMsgs = [...messages.value]
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (wasSelected) { selectedId.value = null; activeConv.value = null; messages.value = [] }
    try { await chatApi.deleteConversation(id) } catch (e) { conversations.value = backup; if (wasSelected) { activeConv.value = backupActive; messages.value = backupMsgs; selectedId.value = id }; throw e }
  }

  function scrollToBottom() {
    if (scrollRaf !== null) cancelAnimationFrame(scrollRaf)
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null
      nextTick(() => {
        const el = document.getElementById('chat-messages')
        if (el) el.scrollTop = el.scrollHeight
      })
    })
  }

  function handleIncoming(msg: Message) {
    if (!alive) return
    if (seenIds.has(msg.id)) return
    seenIds.add(msg.id)
    const isOwn = msg.sender_id === getUid()
    const isViewing = msg.conversation_id === selectedId.value && isChatPageOpen()
    if (isViewing) {
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
      syncConversationPreview(msg)
      if (msg.sender_id !== getUid()) {
        const conv0 = conversations.value.find(c=>c.id===msg.conversation_id)
        if (conv0) (conv0 as any).unread_count = 0
        chatApi.markDelivered(msg.conversation_id).catch(()=>{})
        chatApi.markRead(msg.conversation_id).catch(()=>{})
      } else {
        const conv0 = conversations.value.find(c=>c.id===msg.conversation_id)
        if (conv0) (conv0 as any).unread_count = 0
      }
      scrollToBottom()
    } else {
      if (msg.sender_id === getUid()) { syncConversationPreview(msg); return }
      const conv = conversations.value.find((c) => c.id === msg.conversation_id)
      if (isOwn) {
        if (conv) syncConversationPreview(msg)
        else loadConversations()
        return
      }
      if (conv) { conv.unread_count = (conv.unread_count || 0) + 1; bumpConversation(msg) }
      else loadConversations()
      if (msg.sender_id !== getUid()) {
        chatApi.markDelivered(msg.conversation_id).catch(()=>{})
      }
    }
  }

  function handleDelivered(e: any) {
    const ids: number[] = e.message_ids || []
    const at = e.delivered_at
    ids.forEach(id => {
      const idx = messages.value.findIndex((m:any)=> m.id===id)
      if(idx!==-1){ (messages.value[idx] as any).delivered_at = at; (messages.value[idx] as any).status = 'delivered' }
      conversations.value.forEach(c=>{ if((c.last_message as any)?.id===id){ (c.last_message as any).delivered_at = at; (c.last_message as any).status='delivered' } })
    })
    if(ids.length===0 && e.conversation_id){
      messages.value.forEach((m:any)=>{ if(m.conversation_id===e.conversation_id && m.sender_id===getUid() && !m.delivered_at && !m.read_at){ m.delivered_at = at; m.status='delivered' }})
    }
  }

  function handleRead(e: any) {
    const ids: number[] = e.message_ids || []
    const at = e.read_at
    if(ids.length){
      ids.forEach(id=>{
        const idx = messages.value.findIndex((m:any)=> m.id===id)
        if(idx!==-1){ (messages.value[idx] as any).read_at = at; (messages.value[idx] as any).delivered_at = (messages.value[idx] as any).delivered_at || at; (messages.value[idx] as any).status='read' }
        conversations.value.forEach(c=>{ if((c.last_message as any)?.id===id){ (c.last_message as any).read_at = at; (c.last_message as any).delivered_at = (c.last_message as any).delivered_at || at; (c.last_message as any).status='read' } })
      })
    } else {
      messages.value.forEach((m:any)=>{ if(m.conversation_id===e.conversation_id && m.sender_id===getUid() && !m.read_at){ m.read_at = at; m.delivered_at = m.delivered_at || at; m.status='read' }})
      conversations.value.forEach(c=>{ if(c.id===e.conversation_id && c.last_message && (c.last_message as any).sender_id===getUid() && !(c.last_message as any).read_at){ (c.last_message as any).read_at = at; (c.last_message as any).delivered_at = (c.last_message as any).delivered_at || at; (c.last_message as any).status='read' } })
    }
  }

  let globalCh: any = null
  let globalSubscribed = false
  function subscribeGlobal() {
    if (globalSubscribed && globalCh) return
    try {
      const echo = getEcho()
      if (!echo) return
      const uid = getUid() || document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (uid) {
        globalSubscribed = true
        globalCh = echo.private(`user.${uid}`)
        globalCh.listen('.message.sent', (e: any) => handleIncoming(e.message))
        globalCh.listen('.message.updated', (e: any) => handleUpdated(e.message))
        globalCh.listen('.message.deleted', (e: any) => handleDeleted(e))
        globalCh.listen('.friendship.updated', () => loadConversations())
        globalCh.listen('.message.delivered', (e: any) => handleDelivered(e))
        globalCh.listen('.message.read', (e: any) => handleRead(e))
      }
    } catch { globalSubscribed = false }
  }

  function handleUpdated(msg: Message) {
    const idx = messages.value.findIndex((m) => m.id === msg.id)
    if (idx !== -1) messages.value[idx] = msg
    const conv = conversations.value.find((c) => c.id === msg.conversation_id)
    if (conv && (conv as any).last_message?.id === msg.id) { (conv as any).last_message = msg; sortConversations() }
  }

  function handleDeleted(payload: any) {
    const mid = Number(payload.message_id ?? payload.id)
    if (!mid) return
    messages.value = messages.value.filter((m) => m.id !== mid)
    const conv = conversations.value.find((c) => (c as any).last_message?.id === mid)
    if (conv) loadConversations()
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
      ch.listen('.message.deleted', (e: any) => handleDeleted(e))
      ch.listen('.message.delivered', (e: any) => handleDelivered(e))
      ch.listen('.message.read', (e: any) => handleRead(e))
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
      ch.listen('.typing', handleTyping)
      echoChannels.push(ch)
    } catch {}
  }

  async function searchUsers(q: string) {
    if (searchAbort) { searchAbort.abort(); searchAbort = null }
    if (q.length < 2) { searchResults.value = []; searching.value = false; return }
    searching.value = true
    const ctrl = new AbortController()
    searchAbort = ctrl
    try {
      const res = await chatApi.search(q)
      if (ctrl.signal.aborted) return
      searchResults.value = res
    } catch (e: any) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || ctrl.signal.aborted) return
      throw e
    } finally {
      if (searchAbort === ctrl) { searching.value = false; searchAbort = null }
    }
  }

  watch(searchQuery, (q) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => searchUsers(q.trim()), 320)
  })

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

  onMounted(() => { loadConversations(); subscribeGlobal(); window.addEventListener('focus', loadConversations) })
  onBeforeUnmount(() => {
    alive = false
    selectedId.value = null
    if (typingTimeout) clearTimeout(typingTimeout)
    typingExpire.forEach((t) => clearTimeout(t))
    window.removeEventListener('focus', loadConversations)
    try {
      const echo = getEcho()
      if (activeChatChannel && activeChatId !== null) try { echo.leave(`chat.${activeChatId}`) } catch {}
      echoChannels = echoChannels.filter((c:any)=> c!==activeChatChannel)
      activeChatChannel = null
      activeChatId = null
    } catch {}
  })

  return {
    conversations, activeConv, messages, loading, sending, refreshing, typingUsers,
    searchQuery, searchResults, searching, selectedId, error, unreadTotal, unreadMessagesTotal,
    editingId, editingBody,
    loadConversations, refresh, openConversation, createConversation, sendMessage, startEdit, cancelEdit, saveEdit, deleteMessage, deleteConversation, searchUsers, notifyTyping, stopTyping, handleIncoming, handleUpdated,
  }
}
