import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { chatApi, CHAT_HISTORY_PAGE_SIZE } from '@/services/chat.api'
import { useChatHistory } from '@/composables/useChatHistory'
import { busOn, busEmit, registerPollContextProvider } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'
import { pokeRealtime, syncRealtimeNow } from '@/composables/useRealtimePoller'
import { captureAuthUid, currentAuthUid } from '@/composables/useAuthUid'
import { useRewardToast } from '@/composables/useRewardToast'
import type { Conversation, ConversationDetail, Message } from '@/types/entities/Chat'

let searchAbort: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let loadConversationsInflight: Promise<Conversation[]> | null = null
const trackedUserChannels = new Set<number>()
const trackedChatChannels = new Set<number>()

/**
 * Глобальный сброс чат-подписок при смене аккаунта.
 */
export function resetChatSession(): void {
  try {
    const echo = (window as any).Echo
    if (echo) {
      trackedUserChannels.forEach((uid) => {
        try { echo.leave(`user.${uid}`) } catch {}
      })
      trackedChatChannels.forEach((id) => {
        try { echo.leave(`chat.${id}`) } catch {}
      })
    }
  } catch {}
  trackedUserChannels.clear()
  trackedChatChannels.clear()
  loadConversationsInflight = null
  try {
    const w = window as any
    w.__conversationsInflight = null
  } catch {}
}

/**
 * Вид вложения для optimistic-сообщения по mime файла.
 *
 * @param file выбранный файл
 * @returns image для картинок, voice для аудио, file для остального
 */
function voiceKindFor(file: File): 'image' | 'voice' | 'file' {
  if (/^image\//i.test(file.type)) {
    return 'image'
  }
  if (/^audio\//i.test(file.type)) {
    return 'voice'
  }
  return 'file'
}

export function useChat() {
  captureAuthUid()
  const rewards = useRewardToast()
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
  /** Отправка упёрлась в неподтверждённую почту. */
  const emailBlocked = ref(false)
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

  /**
   * Тост про неподтверждённую почту при попытке писать.
   *
   * @param detail текст отказа с бэкенда
   */
  function notifyEmailBlocked(detail?: string) {
    emailBlocked.value = true
    toast?.add({
      severity: 'warn',
      summary: '📧 Подтверди почту',
      detail: detail || 'Писать сообщения можно после подтверждения почты. Ссылка уже летит на твой email.',
      life: 5200,
    })
  }
  let echoChannels: any[] = []
  let activeChatChannel: any = null
  let activeChatId: number | null = null
  let alive = true
  const recentIds = new Map<number, number>()
  const deletedIds = new Set<number>()
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let typingThrottleUntil = 0
  const typingExpire = new Map<number, ReturnType<typeof setTimeout>>()
  /** Метки локального прочтения диалогов: свежие превью поллинга с протухшим unread_count их не воскрешают (см. applyPreviews). */
  const localReadAt = new Map<number, number>()

  /**
   * Короткий дедуп двойной доставки (user.* + chat.* шлют одно событие).
   * @param id id сообщения
   * @returns true если это дубль в окне 5с
   */
  function isDuplicate(id: number): boolean {
    const now = Date.now()
    const prev = recentIds.get(id)
    if (prev !== undefined && now - prev < 5000) return true
    recentIds.set(id, now)
    if (recentIds.size > 500) {
      const first = recentIds.keys().next().value as number | undefined
      if (first !== undefined) recentIds.delete(first)
    }
    return false
  }

  const unreadTotal = computed(() => conversations.value.filter((c) => Number(c?.unread_count || 0) > 0).length)
  const unreadMessagesTotal = computed(() => conversations.value.reduce((s, c) => s + (Number(c?.unread_count) || 0), 0))
  const conversationsPage = ref(1)
  const conversationsLastPage = ref(1)
  const conversationsHasMore = ref(false)
  const conversationsLoadingMore = ref(false)
  const history = useChatHistory(messages, {
    loadPage: (beforeId: number) => chatApi.messagesPage(selectedId.value!, beforeId, CHAT_HISTORY_PAGE_SIZE),
    getKey: () => selectedId.value,
  }, {
    isSuspended: () => loading.value,
  })

  /**
   * Начальный флаг hasMore из ответа диалога: точный messages_has_more
   * с бэка, иначе эвристика по размеру первой страницы.
   * @param detail ответ getConversation
   */
  function initialHasMore(detail: ConversationDetail): boolean {
    if (typeof (detail as { messages_has_more?: unknown }).messages_has_more === 'boolean') {
      return (detail as { messages_has_more: boolean }).messages_has_more
    }
    return (Array.isArray(detail.messages) ? detail.messages.length : 0) >= CHAT_HISTORY_PAGE_SIZE
  }

  function getEcho(): any {
    return (window as any).Echo
  }
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

  function normalizeConversations(data: unknown): Conversation[] {
    if (!Array.isArray(data)) return []
    return (data as Conversation[]).filter((c) => c != null && Number((c as any)?.id) > 0)
  }
  function sortConversations() {
    conversations.value = [...conversations.value].sort((a:any,b:any)=> new Date(b.last_message_at||b.updated_at||0).getTime() - new Date(a.last_message_at||a.updated_at||0).getTime())
  }
  /**
   * Новейшее сообщение списка по id (страховка от порядка с сервера).
   * @param list сообщения диалога
   * @returns сообщение с максимальным id или null
   */
  function newestMessage(list: any[]): any | null {
    let best: any | null = null
    for (const m of (Array.isArray(list) ? list : [])) {
      if (m?.id == null) continue
      if (best == null || Number(m.id) > Number(best.id)) best = m
    }
    return best
  }
  function bumpConversation(msg: any) {
    if (!msg || msg.conversation_id == null) return
    const idx = conversations.value.findIndex((c) => c?.id === msg.conversation_id)
    if (idx === -1) {
      void loadConversations()
        .then(() => {
          const retry = conversations.value.findIndex((c) => c?.id === msg.conversation_id)
          if (retry !== -1) applyPreview(conversations.value[retry] as any, msg)
        })
        .catch(() => {})
      return
    }
    applyPreview(conversations.value[idx] as any, msg)
    conversations.value = [conversations.value[idx], ...conversations.value.filter((c) => c?.id !== msg.conversation_id)]
  }
  /**
   * Кладет свежее сообщение в превью диалога.
   * @param conv строка диалога из сайдбара
   * @param msg сообщение (отправка или сокет)
   */
  function applyPreview(conv: any, msg: any): void {
    if (!conv || !msg) return
    conv.last_message = msg
    conv.last_message_at = msg.created_at
  }
  function syncConversationPreview(msg: any) {
    bumpConversation(msg)
  }
  /**
   * Сливает свежий список диалогов с локальным, не откатывая превью.
   * Ответ сервера мог стартовать до нашей отправки — более новое
   * локальное last_message (по id) сохраняется.
   * @param fresh диалоги с сервера
   * @returns merged список для сайдбара
   */
  function mergeConversationPreviews(fresh: Conversation[]): Conversation[] {
    const prev = new Map<number, any>()
    for (const c of conversations.value) {
      if (c?.id != null) prev.set(Number(c.id), c)
    }
    for (const n of fresh as any[]) {
      const old = prev.get(Number(n?.id))
      const oldLast = old?.last_message
      const newLast = (n as any)?.last_message
      if (oldLast?.id != null && Number(oldLast.id) > Number(newLast?.id ?? 0) && !deletedIds.has(Number(oldLast.id))) {
        ;(n as any).last_message = oldLast
        ;(n as any).last_message_at = old.last_message_at
      }
    }
    return fresh
  }
  async function loadConversations() {
    const w = window as any
    if (loadConversationsInflight) return loadConversationsInflight.then(d => { conversations.value = mergeConversationPreviews(normalizeConversations(d)); return conversations.value })
    if (w.__conversationsInflight) return w.__conversationsInflight.then((d: Conversation[]) => { conversations.value = mergeConversationPreviews(normalizeConversations(d)); return conversations.value })
    loadConversationsInflight = chatApi.conversations() as Promise<Conversation[]>
    w.__conversationsInflight = loadConversationsInflight
    try {
      const data = await loadConversationsInflight
      conversations.value = mergeConversationPreviews(normalizeConversations(data))
      // Первая страница; hasMore узнаем лениво при скролле сайдбара
      conversationsPage.value = 1
      try {
        const meta = await chatApi.conversationsPage(1, 20)
        conversationsLastPage.value = meta.last_page ?? 1
        conversationsHasMore.value = !!meta.has_more
      } catch { conversationsHasMore.value = false }
      return conversations.value
    } finally { loadConversationsInflight = null; w.__conversationsInflight = null }
  }

  /**
   * Догрузить следующую страницу диалогов для infinite scroll сайдбара.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreConversations(): Promise<boolean> {
    if (conversationsLoadingMore.value || !conversationsHasMore.value) return false
    conversationsLoadingMore.value = true
    try {
      const next = conversationsPage.value + 1
      const res = await chatApi.conversationsPage(next, 20)
      const rows = normalizeConversations(res.data)
      const known = new Set(conversations.value.map((c) => Number(c?.id)))
      const fresh = rows.filter((c) => !known.has(Number(c?.id)))
      conversations.value = mergeConversationPreviews([...conversations.value, ...fresh])
      conversationsPage.value = res.current_page ?? next
      conversationsLastPage.value = res.last_page ?? conversationsPage.value
      conversationsHasMore.value = !!res.has_more
      return fresh.length > 0
    } catch { return false } finally { conversationsLoadingMore.value = false }
  }

  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      await loadConversations()
      if (selectedId.value) {
        const currentId = selectedId.value
        const d = await chatApi.getConversation(currentId)
        if (selectedId.value !== currentId) return
        activeConv.value = d
        messages.value = mergeFetched(currentId, Array.isArray(d.messages) ? d.messages : [])
        await nextTick()
        history.reset(initialHasMore(d))
      }
    } finally { refreshing.value = false }
  }

  /**
   * Объединяет сообщения с сервера с локальными (optimistic + realtime),
   * чтобы refresh/открытие не затирало свежие сообщения из сокета.
   * @param convId id диалога
   * @param fetched сообщения с сервера
   * @returns объединённый отсортированный список
   */
  function mergeFetched(convId: number, fetched: Message[]): Message[] {
    const byId = new Map<number, any>()
    for (const m of (Array.isArray(fetched) ? fetched : []) as any[]) {
      if (m?.id == null) continue
      byId.set(m.id, m)
    }
    for (const m of messages.value as any[]) {
      if (!m) continue
      const belongs = Number(m.conversation_id) === Number(convId)
      const isPending = m.id < 0 || (m as any).pending || (m as any).failed
      if (!belongs && !isPending) continue
      if (isPending || !byId.has(m.id)) {
        byId.set(m.id, m)
      }
    }
    const list = [...byId.values()]
    list.sort((a: any, b: any) => Number(a.id) - Number(b.id))
    return list as Message[]
  }

  async function openConversation(id: number, force = false) {
    if (!force && selectedId.value === id && activeConv.value?.id === id && !loading.value) {
      const conv = conversations.value.find((c) => c?.id === id) as any
      const hasUnread = Number(conv?.unread_count || 0) > 0
      const lastId = Number(conv?.last_message?.id || 0)
      const hasLast = lastId > 0 && messages.value.some((m) => Number(m?.id) === lastId)
      if (!hasUnread && (lastId === 0 || hasLast)) return
    }
    selectedId.value = id
    const cached = conversations.value.find((c) => c?.id === id) as any
    const cachedType = String(cached?.type ?? 'direct')
    const isCachedDistrict = cachedType === 'district'
    if (cached && (cached?.other || isCachedDistrict)) {
      const districtId = Number(cached?.district_id ?? 0)
      const districtTitle = cached?.title ?? null
      const inviteRight = cached?.can_invite ?? false
      activeConv.value = { id, type: cachedType, district_id: districtId, title: districtTitle, can_invite: inviteRight, other: cached.other ?? null, participants: [], wallpaper: (cached as any)?.wallpaper ?? null } as any
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
      const detailMessages = Array.isArray(d.messages) ? d.messages : []
      messages.value = mergeFetched(id, detailMessages)
      const newest = newestMessage(detailMessages)
      const conv = conversations.value.find((c) => c?.id === id)
      if (conv) {
        noteLocalRead(id)
        if (newest) bumpConversation(newest)
      } else if (newest) {
        loadConversations()
      }
      try { await chatApi.markRead(id) } catch {}
      subscribeChat(id)
      try { syncRealtimeNow() } catch {}
      await nextTick()
      history.reset(initialHasMore(d))
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

  /**
   * Заменяет optimistic-сообщение ответом сервера в открытом диалоге.
   * @param tempId временный id optimistic-сообщения
   * @param msg сообщение с сервера
   */
  function applySentResult(tempId: number, msg: any): void {
    const tempIdx = messages.value.findIndex((m) => m?.id === tempId)
    const existsIdx = messages.value.findIndex((m) => m?.id === msg.id)
    if (tempIdx !== -1 && existsIdx !== -1) {
      messages.value.splice(tempIdx, 1)
      const real = messages.value.find((x) => x?.id === msg.id) as any
      if (real) real.justSent = true
      return
    }
    if (tempIdx !== -1) {
      ;(messages.value[tempIdx] as any) = { ...(msg as any), justSent: true }
      return
    }
    if (existsIdx === -1) {
      messages.value.push({ ...(msg as any), justSent: true } as any)
    }
  }

  async function sendMessage(body: string, replyTo?: any | null, attachmentFile?: File | null, voiceDuration?: number | null) {
    const targetId = selectedId.value
    const text = body.trim()
    if (!targetId || (!text && !attachmentFile)) return
    if (sending.value) return
    const tempId = -Math.floor(Math.random()*1e9) - Date.now()%1e6
    const uid = getUid()
    sendTypingWs(false)
    if (typingTimeout) { clearTimeout(typingTimeout); typingTimeout = null }
    const replySnapshot = replyTo ? {
      id: replyTo.id,
      body: replyTo.body,
      sender_id: replyTo.sender_id,
      sender_name: replyTo.sender?.name ?? null,
      kind: replyTo.attachment?.kind ?? replyTo.type ?? null,
      duration: replyTo.attachment?.duration ?? null,
    } : null
    const optimisticKind = attachmentFile ? voiceKindFor(attachmentFile) : null
    const optimisticAttachment = attachmentFile ? {
      url: URL.createObjectURL(attachmentFile),
      name: attachmentFile.name,
      size: attachmentFile.size,
      kind: optimisticKind,
      duration: voiceDuration ?? null,
      local: true,
    } : null
    const optimistic: any = { id: tempId, conversation_id: targetId, reply_to_id: replyTo?.id ?? null, reply_to: replySnapshot, sender_id: uid, body: text, type: optimisticAttachment ? optimisticKind : 'text', attachment: optimisticAttachment, created_at: new Date().toISOString(), pending: true }
    messages.value.push(optimistic)
    history.notifyAppended()
    sending.value = true
    try {
      const msg = await chatApi.sendMessage(targetId, text, replyTo?.id ?? null, attachmentFile ?? null, voiceDuration ?? null)
      rewards.applyReward(msg)
      if (optimisticAttachment?.url) {
        try { URL.revokeObjectURL(optimisticAttachment.url) } catch {}
      }
      if (selectedId.value === targetId) {
        applySentResult(tempId, msg)
        history.notifyAppended()
      }
      syncConversationPreview(msg)
      try { pokeRealtime() } catch {}
      setTimeout(() => { const m = messages.value.find((x) => x?.id === msg.id) as any; if (m) m.justSent = false }, 600)
    } catch (e: any) {
      const idx = messages.value.findIndex((m) => m?.id === tempId)
      if (idx !== -1) (messages.value[idx] as any).failed = true
      const msg = e?.response?.data?.message || ''
      if (e?.response?.status === 403 && e?.response?.data?.email_unverified === true) {
        if (idx !== -1) messages.value.splice(idx, 1)
        notifyEmailBlocked(msg)
        throw e
      }
      if (e?.response?.status === 403 && msg.includes('заблокировал')) {
        if (idx !== -1) messages.value.splice(idx, 1)
      }
      throw e
    } finally { sending.value = false }
  }

  function startEdit(msg: Message) {
    if (msg?.sender_id !== getUid()) return
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
    const idx = messages.value.findIndex((m) => m?.id === id)
    if (idx !== -1) (messages.value[idx] as any).pending = true
    try {
      const updated = await chatApi.editMessage(id, body)
      const i = messages.value.findIndex((m) => m?.id === id)
      if (i !== -1) messages.value[i] = updated
      const conv = conversations.value.find((c) => c?.id === updated.conversation_id)
      if (conv && (conv as any).last_message?.id === id) { (conv as any).last_message = updated; sortConversations() }
      cancelEdit()
    } catch (e) {
      if (idx !== -1) (messages.value[idx] as any).pending = false
      throw e
    }
  }

  async function deleteMessage(id: number) {
    const backup = [...messages.value]
    messages.value = messages.value.filter((m) => m?.id !== id)
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
    conversations.value = conversations.value.filter((c) => c?.id !== id)
    if (wasSelected) { selectedId.value = null; activeConv.value = null; messages.value = [] }
    try { await chatApi.deleteConversation(id) } catch (e) { conversations.value = backup; if (wasSelected) { activeConv.value = backupActive; messages.value = backupMsgs; selectedId.value = id }; throw e }
  }

  /**
   * Убрать все диалоги из своего списка навсегда.
   */
  async function clearAllConversations(): Promise<void> {
    const backupConvs = [...conversations.value]
    const backupActive = activeConv.value
    const backupMsgs = [...messages.value]
    const backupSelected = selectedId.value
    conversations.value = []
    selectedId.value = null
    activeConv.value = null
    messages.value = []
    try {
      await chatApi.clearConversations()
    } catch (e) {
      conversations.value = backupConvs
      selectedId.value = backupSelected
      activeConv.value = backupActive
      messages.value = backupMsgs
      throw e
    }
  }

  function handleIncoming(msg: Message) {
    if (!alive) return
    if (!msg || (msg as any)?.id == null) return
    const id = Number((msg as any).id)
    const alreadyShown = messages.value.some((m) => Number(m?.id) === id)
    if (alreadyShown) {
      const pendingIdx = messages.value.findIndex((m: any) => m?.pending && Number(m?.conversation_id) === Number(msg.conversation_id))
      if (pendingIdx !== -1) messages.value.splice(pendingIdx, 1)
      syncConversationPreview(msg)
      return
    }
    if (isDuplicate(id)) return
    // Прочитанным помечаем только реально открытый диалог: мало совпадения
    // selectedId (он мог остаться от прошлого экрана) — требуем, чтобы
    // activeConv был загружен под этот же диалог. Иначе новый месседж,
    // прилетевший на списке чатов, тихо помечался бы прочитанным.
    const selectedConv = Number(selectedId.value)
    const openedConv = Number((activeConv.value as any)?.id ?? 0)
    const isViewing = Number(msg.conversation_id) === selectedConv && selectedConv !== 0 && selectedConv === openedConv && isChatPageOpen()
    if (isViewing) {
      appendLiveMessage(msg)
      const n = new Set(typingUsers.value); n.delete(msg.sender_id); typingUsers.value = n
      const t = typingExpire.get(msg.sender_id); if (t) { clearTimeout(t); typingExpire.delete(msg.sender_id) }
      syncConversationPreview(msg)
      noteLocalRead(Number(msg.conversation_id))
      if (msg.sender_id !== getUid()) {
        chatApi.markDelivered(msg.conversation_id).catch(()=>{})
        chatApi.markRead(msg.conversation_id).catch(()=>{})
      }
      history.notifyAppended()
      return
    }
    if (msg.sender_id === getUid()) { syncConversationPreview(msg); return }
    if (Number(msg.conversation_id) === Number(selectedId.value)) {
      appendLiveMessage(msg)
      history.notifyAppended()
    }
    const conv = conversations.value.find((c) => c?.id === msg.conversation_id)
    if (conv) { conv.unread_count = (conv.unread_count || 0) + 1; bumpConversation(msg) }
    else loadConversations()
    if (msg.sender_id !== getUid()) {
      chatApi.markDelivered(msg.conversation_id).catch(()=>{})
    }
  }

  /**
   * Добавляет live-сообщение в открытый диалог с заменой optimistic.
   * @param msg сообщение из сокета
   */
  function appendLiveMessage(msg: Message): void {
    if (!msg?.id) return
    const pendingIdx = messages.value.findIndex((m: any) => m?.pending && Number(m?.conversation_id) === Number(msg.conversation_id) && Number(m?.sender_id) === Number(msg.sender_id))
    if (pendingIdx !== -1) {
      const bodyIdx = messages.value.findIndex((m: any) => m?.pending && (m as any)?.body === (msg as any)?.body && Number(m?.sender_id) === Number(msg.sender_id))
      const target = bodyIdx !== -1 ? bodyIdx : pendingIdx
      if (messages.value.some((m) => Number(m?.id) === Number(msg.id))) {
        messages.value.splice(target, 1)
        return
      }
      ;(messages.value as any)[target] = msg
      return
    }
    if (!messages.value.some((m) => Number(m?.id) === Number(msg.id))) messages.value.push(msg)
  }

  function handleDelivered(e: any) {
    const ids: number[] = e?.message_ids || []
    const at = e?.delivered_at
    ids.forEach(id => {
      const idx = messages.value.findIndex((m:any)=> m?.id===id)
      if(idx!==-1){ (messages.value[idx] as any).delivered_at = at; (messages.value[idx] as any).status = 'delivered' }
      conversations.value.forEach(c=>{ if((c?.last_message as any)?.id===id){ (c.last_message as any).delivered_at = at; (c.last_message as any).status='delivered' } })
    })
    if(ids.length===0 && e?.conversation_id){
      messages.value.forEach((m:any)=>{ if(m?.conversation_id===e.conversation_id && m?.sender_id===getUid() && !m?.delivered_at && !m?.read_at){ m.delivered_at = at; m.status='delivered' }})
    }
  }

  function handleRead(e: any) {
    const ids: number[] = e?.message_ids || []
    const at = e?.read_at
    if(ids.length){
      ids.forEach(id=>{
        const idx = messages.value.findIndex((m:any)=> m?.id===id)
        if(idx!==-1){ (messages.value[idx] as any).read_at = at; (messages.value[idx] as any).delivered_at = (messages.value[idx] as any).delivered_at || at; (messages.value[idx] as any).status='read' }
        conversations.value.forEach(c=>{ if((c?.last_message as any)?.id===id){ (c.last_message as any).read_at = at; (c.last_message as any).delivered_at = (c.last_message as any).delivered_at || at; (c.last_message as any).status='read' } })
      })
    } else {
      messages.value.forEach((m:any)=>{ if(m?.conversation_id===e?.conversation_id && m?.sender_id===getUid() && !m?.read_at){ m.read_at = at; m.delivered_at = m.delivered_at || at; m.status='read' }})
      conversations.value.forEach(c=>{ if(c?.id===e?.conversation_id && c?.last_message && (c.last_message as any)?.sender_id===getUid() && !(c.last_message as any)?.read_at){ (c.last_message as any).read_at = at; (c.last_message as any).delivered_at = (c.last_message as any).delivered_at || at; (c.last_message as any).status='read' } })
    }
  }

  let globalSubscribed = false
  let globalUid: number | null = null
  let busUnsubs: Array<() => void> = []

  /**
   * Подписки на шину polling-режима: сообщения, typing, превью.
   * В socket-режиме шина молчит, дубли исключены дедупом handleIncoming.
   */
  function subscribeRealtimeBus(): void {
    try {
      registerPollContextProvider('chat', () => ({ conversationId: selectedId.value }))
      busUnsubs.push(busOn('chat:message', (msg: any) => handleIncoming(msg as Message)))
      busUnsubs.push(busOn('chat:typing', (e: any) => syncTypingFromPoll(Number(e?.conversationId), e?.userIds)))
      busUnsubs.push(busOn('chat:previews', (previews: any[]) => applyPreviews(previews)))
      busUnsubs.push(busOn('chat:peer', (e: any) => applyPeer(Number(e?.conversationId), e?.peer)))
      busUnsubs.push(busOn('chat:open-ids', (e: any) => applyOpenIds(Number(e?.conversationId), e?.ids)))
      busUnsubs.push(busOn('chat:dialog-read', (convId: number) => applyDialogRead(Number(convId))))
    } catch {}
  }

  /**
   * Освежает «в сети» собеседника из поллинга.
   * @param conversationId диалог
   * @param peer состояние собеседника
   */
  function applyPeer(conversationId: number, peer: any): void {
    if (!peer || Number(conversationId) !== Number(selectedId.value)) return
    if (activeConv.value?.other && Number((activeConv.value.other as any)?.id) === Number(peer.id)) {
      (activeConv.value.other as any).last_seen_at = peer.last_seen_at ?? null
    }
    const conv = conversations.value.find((c) => c?.id === Number(conversationId)) as any
    if (conv?.other && Number(conv.other?.id) === Number(peer.id)) {
      conv.other.last_seen_at = peer.last_seen_at ?? null
    }
  }
  function subscribeGlobal() {
    if (globalSubscribed) return
    try {
      const uid = getUid()
      if (!uid) return
      if (globalUid !== null && globalUid !== uid) resetChatRealtime()
      globalSubscribed = true
      globalUid = uid
      trackedUserChannels.add(Number(uid))
      ensureUserChannel()
      busUnsubs.push(busOn('user:message.sent', (e: any) => handleIncoming(e.message as Message)))
      busUnsubs.push(busOn('user:message.updated', (e: any) => handleUpdated(e.message as Message)))
      busUnsubs.push(busOn('user:message.deleted', (e: any) => handleDeleted(e)))
      busUnsubs.push(busOn('user:friendship.updated', () => loadConversations()))
      busUnsubs.push(busOn('user:message.delivered', (e: any) => handleDelivered(e)))
      busUnsubs.push(busOn('user:message.read', (e: any) => handleRead(e)))
      busUnsubs.push(busOn('user:notification.created', (e: any) => handleSosClosed(e)))
      busUnsubs.push(busOn('chat:receipts', (list: any[]) => applyReceipts(list)))
    } catch { globalSubscribed = false }
  }

  /**
   * Применяет статусы доставки/прочтения из поллинга.
   * @param list квитанции {id, conversation_id, delivered_at, read_at}
   */
  function applyReceipts(list: any[]): void {
    if (!Array.isArray(list) || !list.length) return
    for (const r of list) {
      if (r?.id == null) continue
      const idx = messages.value.findIndex((m: any) => m?.id === Number(r.id))
      if (idx !== -1) {
        const current = messages.value[idx] as any
        if (r.delivered_at) current.delivered_at = r.delivered_at
        if (r.read_at) {
          current.read_at = r.read_at
          current.delivered_at = current.delivered_at || r.read_at
        }
      }
      conversations.value.forEach((c: any) => {
        if (c?.last_message && Number((c.last_message as any)?.id) === Number(r.id)) {
          if (r.delivered_at) (c.last_message as any).delivered_at = r.delivered_at
          if (r.read_at) {
            (c.last_message as any).read_at = r.read_at
            ;(c.last_message as any).delivered_at = (c.last_message as any).delivered_at || r.read_at
          }
        }
      })
    }
  }

  /**
   * Сбросить realtime чата при смене аккаунта.
   */
  function resetChatRealtime(): void {
    try {
      leaveUserChannel()
      const echo = getEcho()
      if (echo && activeChatId !== null) try { echo.leave(`chat.${activeChatId}`) } catch {}
    } catch {}
    globalSubscribed = false
    globalUid = null
    activeChatChannel = null
    activeChatId = null
    echoChannels = []
    recentIds.clear()
    selectedId.value = null
    activeConv.value = null
    messages.value = []
    conversations.value = []
  }

  function handleUpdated(msg: Message) {
    if (!msg?.id) return
    const idx = messages.value.findIndex((m) => m?.id === msg.id)
    if (idx !== -1) messages.value[idx] = msg
    const conv = conversations.value.find((c) => c?.id === msg.conversation_id)
    if (conv && (conv as any)?.last_message?.id === msg.id) { (conv as any).last_message = msg; sortConversations() }
  }

  function handleDeleted(payload: any) {
    if (!payload) return
    const mid = Number(payload.message_id ?? payload.id)
    if (!mid) return
    deletedIds.add(mid)
    if (deletedIds.size > 500) {
      const first = deletedIds.values().next().value as number | undefined
      if (first !== undefined) deletedIds.delete(first)
    }
    messages.value = messages.value.filter((m) => m?.id !== mid)
    const conv = conversations.value.find((c) => (c as any)?.last_message?.id === mid)
    if (conv) loadConversations()
  }

  /**
   * SOS-чат завершён: убрать диалог из списка у обоих, закрыть открытый.
   *
   * Прилетает inbox-уведомлением sos.chat_closed по обоим транспортам
   * (сокет user.* + polling user:notification.created), поэтому дублей нет:
   * повторное удаление уже отсутствующего id — no-op.
   * @param e событие user:notification.created
   */
  function handleSosClosed(e: any) {
    const s = e?.notification?.data?.sos_chat_closed
    if (!s?.conversation_id) return
    const cid = Number(s.conversation_id)
    if (!cid || !conversations.value.some((c) => Number(c?.id) === cid)) {
      if (Number(selectedId.value) === cid) {
        selectedId.value = null
        activeConv.value = null
        messages.value = []
      }
      return
    }
    conversations.value = conversations.value.filter((c) => Number(c?.id) !== cid)
    if (Number(selectedId.value) === cid) {
      selectedId.value = null
      activeConv.value = null
      messages.value = []
    }
    toast?.add({
      severity: 'info',
      summary: '🆘 SOS-чат удалён',
      detail: 'История сохранена в архив (вложения).',
      life: 5000,
    })
  }
  function subscribeChat(convId: number) {
    try {
      const echo = getEcho()
      if (!echo) return
      if (activeChatChannel && activeChatId !== null && activeChatId !== convId) {
        try { echo.leave(`chat.${activeChatId}`) } catch {}
        echoChannels = echoChannels.filter((c:any)=> c!==activeChatChannel)
        activeChatChannel = null
      }
      if (activeChatChannel && activeChatId === convId) return
      const ch = echo.private(`chat.${convId}`)
      activeChatChannel = ch
      activeChatId = convId
      trackedChatChannels.add(Number(convId))
      ch.listen('.message.sent', (e: any) => handleIncoming(e.message))
      ch.listen('.message.updated', (e: any) => handleUpdated(e.message))
      ch.listen('.message.deleted', (e: any) => handleDeleted(e))
      ch.listen('.message.delivered', (e: any) => handleDelivered(e))
      ch.listen('.message.read', (e: any) => handleRead(e))
      const handleTyping = (e: any) => {
        applyTypingState(Number(e.user_id), !!e.is_typing)
      }
      ch.listenForWhisper('typing', handleTyping)
      ch.listen('.typing', handleTyping)
      echoChannels.push(ch)
    } catch {}
  }

  /**
   * Применяет состояние "печатает" (сокет и поллинг идут сюда же).
   * @param userId кто печатает
   * @param isTyping печатает или перестал
   */
  function applyTypingState(userId: number, isTyping: boolean): void {
    const id = Number(userId)
    if (!id || id === getUid()) return
    if (isTyping) {
      const n = new Set(typingUsers.value)
      n.add(id)
      typingUsers.value = n
      const prev = typingExpire.get(id)
      if (prev) clearTimeout(prev)
      const timer = setTimeout(() => {
        const nn = new Set(typingUsers.value)
        nn.delete(id)
        typingUsers.value = nn
        typingExpire.delete(id)
      }, 2500)
      typingExpire.set(id, timer)
    } else {
      const n = new Set(typingUsers.value)
      n.delete(id)
      typingUsers.value = n
      const t = typingExpire.get(id)
      if (t) {
        clearTimeout(t)
        typingExpire.delete(id)
      }
    }
  }

  /**
   * Синхронизирует "печатают" из поллинга: сервер отдаёт полный срез.
   * @param conversationId диалог среза
   * @param userIds печатающие прямо сейчас
   */
  function syncTypingFromPoll(conversationId: number, userIds: number[]): void {
    if (Number(conversationId) !== Number(selectedId.value)) return
    const selfId = getUid()
    const next = new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => Number(id))
        .filter((id) => id > 0 && id !== selfId),
    )
    typingExpire.forEach((timer, id) => {
      if (!next.has(id)) {
        clearTimeout(timer)
        typingExpire.delete(id)
      }
    })
    typingUsers.value = next
  }

  /**
   * Локально погасить счётчик диалога: свой список + метка + шина.
   *
   * Метка держится 15с и прикрывает гонку с поллингом: превью,
   * запрошенное до markRead, может вернуться с протухшим
   * `unread_count: 1` и воскресить бейдж (applyPreviews такое режет).
   * Событие `chat:dialog-read` мгновенно гасит тот же диалог
   * в мини-доке и колокольчике — у них свои списки диалогов.
   *
   * @param convId id диалога
   */
  function noteLocalRead(convId: number): void {
    const id = Number(convId)
    if (!(id > 0)) return
    const row = conversations.value.find((c) => c?.id === id) as any
    if (row) row.unread_count = 0
    localReadAt.set(id, Date.now())
    if (localReadAt.size > 100) {
      const first = localReadAt.keys().next().value as number | undefined
      if (first !== undefined) localReadAt.delete(first)
    }
    try {
      busEmit('chat:dialog-read', id)
    } catch {
      // No-op: свой список уже погашен выше.
    }
  }

  /**
   * Погасить диалог по событию `chat:dialog-read` от соседнего
   * списка (мини-окно дока): без метки и без ре-эмита, петля исключена.
   *
   * @param convId id диалога
   */
  function applyDialogRead(convId: number): void {
    const id = Number(convId)
    if (!(id > 0)) return
    const row = conversations.value.find((c) => c?.id === id) as any
    if (row) row.unread_count = 0
  }

  /**
   * Вливает лёгкие превью из поллинга в сайдбар.
   * @param previews превью изменившихся диалогов
   */
  function applyPreviews(previews: any[]): void {
    if (!Array.isArray(previews) || !previews.length) return
    let unknown = false
    for (const preview of previews) {
      const conv = conversations.value.find((c) => c?.id === Number(preview?.id))
      if (!conv) {
        unknown = true
        continue
      }
      if (preview?.last_message) applyPreview(conv as any, preview.last_message)
      if (preview?.unread_count == null) continue
      const readAt = localReadAt.get(Number(preview?.id)) ?? 0
      if (Date.now() - readAt < 15000) continue
      ;(conv as any).unread_count = Number(preview.unread_count)
    }
    sortConversations()
    if (unknown) loadConversations().catch(() => {})
  }

  /**
   * Вычищает жёстко удалённые сообщения из открытого диалога.
   *
   * Поллер отдаёт хвост id (последние 100): локальные моложе минимума
   * среза, но отсутствующие в нём, — удалены. Старые (догружаемая
   * история старше среза) не трогаем, optimistic (id<0) тоже.
   *
   * @param conversationId диалог среза
   * @param ids хвост id с сервера
   */
  function applyOpenIds(conversationId: number, ids: unknown): void {
    if (!alive || Number(conversationId) !== Number(selectedId.value)) return
    if (!Array.isArray(ids) || !ids.length) return
    const serverIds = new Set((ids as unknown[]).map((id) => Number(id)).filter((id) => id > 0))
    let minServer = Number.POSITIVE_INFINITY
    serverIds.forEach((id) => {
      if (id < minServer) minServer = id
    })
    const missing: number[] = []
    for (const local of messages.value as any[]) {
      const id = Number(local?.id)
      if (!(id > 0) || id < minServer || serverIds.has(id)) continue
      missing.push(id)
    }
    if (!missing.length) return
    const gone = new Set(missing)
    missing.forEach((id) => deletedIds.add(id))
    messages.value = messages.value.filter((m: any) => !gone.has(Number(m?.id)))
    const conv = conversations.value.find((c) => c?.id === Number(conversationId)) as any
    if (conv?.last_message && gone.has(Number((conv.last_message as any)?.id))) loadConversations().catch(() => {})
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
      searchResults.value = Array.isArray(res) ? res : ((res as { data?: unknown })?.data as unknown[] ?? [])
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
    const convId = selectedId.value
    try {
      const ch = currentChannel()
      if (ch) ch.whisper('typing', { user_id: getUid(), is_typing: isTyping })
    } catch {}
    void postTypingHttp(convId, isTyping)
  }

  /**
   * Дублирует typing через HTTP: сервер разошлёт `.typing` всем
   * участникам, даже если Reverb отбросил whisper на приватном канале.
   * @param convId id диалога
   * @param isTyping печатает или перестал
   */
  async function postTypingHttp(convId: number, isTyping: boolean): Promise<void> {
    try {
      await chatApi.typing(convId, isTyping)
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

  /**
   * Догружает открытый диалог после возврата из фона: сайдбар уже свежий,
   * а messages могли отстать (сокет молчал или вкладка была скрыта).
   */
  async function resyncOpenConversation(): Promise<void> {
    if (!alive || !selectedId.value || document.hidden) return
    const id = selectedId.value
    try {
      const d = await chatApi.getConversation(id)
      if (!alive || selectedId.value !== id) return
      activeConv.value = d
      messages.value = mergeFetched(id, Array.isArray(d.messages) ? d.messages : [])
      const conv = conversations.value.find((c) => c?.id === id)
      if (conv && Number((conv as any).unread_count || 0) > 0) {
        noteLocalRead(id)
        chatApi.markRead(id).catch(() => {})
      }
      await nextTick()
      history.reset(initialHasMore(d))
    } catch {}
  }

  async function handleFocusResync(): Promise<void> {
    try {
      await loadConversations()
    } catch {}
    await resyncOpenConversation()
    try {
      subscribeGlobal()
      if (selectedId.value) subscribeChat(selectedId.value)
    } catch {}
  }

  onMounted(() => { loadConversations(); subscribeGlobal(); subscribeRealtimeBus(); window.addEventListener('focus', handleFocusResync); document.addEventListener('visibilitychange', handleFocusResync) })
  onBeforeUnmount(() => {
    alive = false
    selectedId.value = null
    globalSubscribed = false
    busUnsubs.forEach((off) => { try { off() } catch {} })
    busUnsubs = []
    if (typingTimeout) clearTimeout(typingTimeout)
    typingExpire.forEach((t) => clearTimeout(t))
    window.removeEventListener('focus', handleFocusResync)
    document.removeEventListener('visibilitychange', handleFocusResync)
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
    searchQuery, searchResults, searching, selectedId, error, emailBlocked, unreadTotal, unreadMessagesTotal,
    editingId, editingBody, history,
    conversationsHasMore, conversationsLoadingMore,
    loadConversations, loadMoreConversations, refresh, openConversation, createConversation, sendMessage, startEdit, cancelEdit, saveEdit, deleteMessage, deleteConversation, clearAllConversations, searchUsers, notifyTyping, stopTyping, handleIncoming, handleUpdated, subscribeGlobal, resetChatRealtime,
  }
}
