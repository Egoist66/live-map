import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useChat } from '@/composables/useChat'
import { useFriendships } from '@/composables/useFriendships'
import { useBlocks } from '@/composables/useBlocks'
import { useEmojiPicker } from '@/composables/useEmojiPicker'
import { useLongPress } from '@/composables/useLongPress'
import { useMessageReply } from '@/composables/useMessageReply'
import { usePinnedMessages } from '@/composables/usePinnedMessages'
import { useChatBadges } from '@/composables/useChatBadges'
import { useChatNavigation } from '@/composables/useChatNavigation'
import { useChatAttachment } from '@/composables/useChatAttachment'
import { useChatLocation } from '@/composables/useChatLocation'
import { useVoiceRecorder } from '@/composables/useVoiceRecorder'
import { chatApi } from '@/services/chat.api'

export function useChatPage(initialConversationId?: number) {
  const chat = useChat()
  const friendsApi = useFriendships()
  const blocksApi = useBlocks()
  const emoji = useEmojiPicker()
  const badgeSync = useChatBadges(chat.unreadTotal, friendsApi.pendingIn, chat.unreadMessagesTotal)
  const nav = useChatNavigation(chat.selectedId, chat.openConversation)

  const input = ref('')
  const inputRef = ref<HTMLInputElement | null>(null)
  const editInputRef = ref<HTMLInputElement | null>(null)
  const tab = ref<'chats' | 'ulove' | 'friends' | 'requests' | 'blocked'>('chats')

  /**
   * Бизнес-аккаунт: ULove-таба нет вообще — только чаты.
   */
  const isBusiness = computed(() => {
    try {
      return ((usePage().props as unknown as { auth?: { user?: { account_type?: string } | null } }).auth?.user?.account_type ?? 'person') === 'business'
    } catch {
      return false
    }
  })

  /**
   * Чаты мэтчей ULove: собеседник с is_match и только direct.
   * SOS-диалоги (type=sos) сюда не попадают — у них обычный стиль.
   * Бизнесу — пусто: мэтчей у компаний не бывает.
   * @returns диалоги ULove
   */
  const uloveConversations = computed(() => {
    if (isBusiness.value) {
      return []
    }
    return chat.conversations.value.filter((c: any) => (c?.type ?? 'direct') === 'direct' && !!(c?.other as any)?.is_match)
  })

  /** Непрочитанные диалоги ULove (счётчик таба). */
  const uloveUnread = computed(() => uloveConversations.value.filter((c: any) => Number(c?.unread_count || 0) > 0).length)

  watch(tab, (next) => {
    if (isBusiness.value && next === 'ulove') {
      tab.value = 'chats'
    }
  })
  const showChatMenu = ref(false)
  const sheet = ref<{ type: 'message' | 'chat' | 'friend' | 'request' | 'search', data: any } | null>(null)
  const showPrivacy = ref(false)
  const privacy = ref({ message_privacy: 'everyone' })
  const creatingChat = ref(false)
  const confirm = ref<{ type: 'block' | 'deleteChat' | 'clearAllChats' | 'deleteMessage' | 'removeFriend' | 'unblock', payload: any, title: string, msg: string, icon: string, confirmLabel: string, severity: 'danger' | 'primary' } | null>(null)
  const confirmVisible = computed({ get: () => !!confirm.value, set: (v) => { if (!v) confirm.value = null } })
  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const pageProps = usePage().props as any
  const isOwnMessage = (m: any) => Number(m?.sender_id) === Number(pageProps.auth?.user?.id)
  const { bind: bindSheet } = useLongPress((p: any) => { sheet.value = p }, 520)
  const reply = useMessageReply()
  const pins = usePinnedMessages(chat.messages as any)
  const attachment = useChatAttachment()
  const chatLocation = useChatLocation()
  const voice = useVoiceRecorder()

  watch(() => chat.activeConv.value, (conv: any) => {
    if (conv?.id) void pins.load(conv.id, { pinned: conv.pinned, pin_limit: conv.pin_limit })
    else pins.reset()
  })

  async function togglePin(m: any) {
    const ok = await pins.toggle(m)
    if (!ok && pins.error.value) {
      toast?.add({ severity: 'warn', summary: 'Не удалось закрепить', detail: pins.error.value, life: 4000 })
    }
  }

  /**
   * Переход к сообщению: догружает историю вверх при нужде и подсвечивает.
   * @param id id сообщения
   */
  async function jumpToMessage(id: number): Promise<void> {
    const found = await chat.history.scrollToMessage(id)
    if (found) {
      pins.flash(id)
      return
    }
    toast?.add({ severity: 'warn', summary: 'Не найдено', detail: 'Сообщение не найдено в истории', life: 3000 })
  }

  function notifyBlockedBy(detail?: string) {
    const msg = detail || 'Пользователь заблокировал вас'
    toast?.add({
      severity: 'error',
      summary: '⛔ Доступ ограничен',
      detail: msg.includes('заблокировал вас') ? 'Этот пользователь заблокировал вас — сообщения не доставляются.' : msg,
      life: 4500,
    })
  }

  async function handleSend() {
    const text = input.value.trim()
    const picked = attachment.file.value
    if (!text && !picked) {
      return
    }
    input.value = ''
    emoji.close()
    const quoted = reply.replyTo.value
    const sendingFile = picked
    attachment.clear()
    try {
      await chat.sendMessage(text, quoted, sendingFile)
      reply.cancelReply()
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.attachment?.[0] || e?.message || ''
      input.value = text
      if (sendingFile && !attachment.file.value) {
        attachment.file.value = sendingFile
      }
      if (status === 403 && msg.includes('заблокировал')) notifyBlockedBy(msg)
      else if (status === 403) toast?.add({ severity: 'warn', summary: 'Нельзя отправить', detail: msg || 'Сообщение не доставлено', life: 3500 })
      else {
        const isTimeout = (e as any)?.code === 'ECONNABORTED'
        const fallback = isTimeout ? 'Нет соединения — сообщение не отправлено, попробуйте снова' : 'Не удалось отправить сообщение'
        toast?.add({ severity: 'error', summary: 'Не отправлено', detail: msg || fallback, life: 3500 })
      }
    }
  }

  /**
   * Принимает файл из input чата: валидация и сжатие картинок.
   * @param target выбранный файл или null
   */
  async function handlePickFile(target: File | null): Promise<void> {
    if (!target) {
      return
    }
    const ok = await attachment.pick(target)
    if (!ok && attachment.error.value) {
      toast?.add({ severity: 'warn', summary: 'Файл не принят', detail: attachment.error.value, life: 3500 })
    }
    focusChatInput()
  }

  /**
   * Вставка картинки из буфера (Ctrl+V скриншота) в инпут чата.
   * Картинка кладётся во вложение как файл и отправляется кнопкой.
   *
   * @param e событие paste из инпута
   */
  async function handlePasteImage(e: ClipboardEvent): Promise<void> {
    const handled = await attachment.pickClipboard(e)
    if (handled) {
      focusChatInput()
      return
    }
    if (attachment.error.value) {
      toast?.add({ severity: 'warn', summary: 'Файл не принят', detail: attachment.error.value, life: 3500 })
      attachment.error.value = null
    }
  }

  /**
   * Поделиться геопозицией: координаты + ссылки на Яндекс и Google карты.
   * @returns void
   */
  async function handleShareLocation(): Promise<void> {
    const quoted = reply.replyTo.value
    const ok = await chatLocation.shareLocation((text) => chat.sendMessage(text, quoted))

    if (ok) {
      reply.cancelReply()
      return
    }

    if (chatLocation.locationError.value) {
      toast?.add({ severity: 'warn', summary: 'Геопозиция', detail: chatLocation.locationError.value, life: 3500 })
    }
  }

  function handleStartReply(m: any) {
    chat.cancelEdit()
    emoji.close()
    reply.startReply(m)
    focusChatInput()
  }

  /**
   * Начинает запись голосового: закрывает эмодзи/редактирование.
   * @returns void
   */
  async function handleStartVoice(): Promise<void> {
    chat.cancelEdit()
    emoji.close()
    const ok = await voice.start()
    if (!ok && voice.error.value) {
      toast?.add({ severity: 'warn', summary: 'Голосовое', detail: voice.error.value, life: 3500 })
    }
  }

  /**
   * Останавливает запись — дальше превью для прослушивания.
   * @returns void
   */
  async function handleStopVoice(): Promise<void> {
    await voice.stop()
  }

  /**
   * Отменяет запись и убирает превью.
   * @returns void
   */
  async function handleCancelVoice(): Promise<void> {
    await voice.cancel()
    voice.discardPreview()
  }

  /**
   * Отправляет записанное голосовое с длительностью.
   * @returns void
   */
  async function handleSendVoice(): Promise<void> {
    const done = voice.finish()
    if (!done) {
      return
    }
    if (done.file.size > 5 * 1024 * 1024) {
      toast?.add({ severity: 'warn', summary: 'Голосовое', detail: 'Запись больше 5 МБ — попробуйте короче', life: 3500 })
      return
    }
    const quoted = reply.replyTo.value
    try {
      await chat.sendMessage('', quoted, done.file, done.duration)
      reply.cancelReply()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.errors?.attachment?.[0] || 'Не удалось отправить голосовое'
      toast?.add({ severity: 'error', summary: 'Не отправлено', detail: msg, life: 3500 })
    }
  }

  const timeCache = new Map<string,string>()
  function formatTime(s: string | null | undefined) {
    if (!s) return ''
    if (timeCache.has(s)) return timeCache.get(s)!
    try { const v = new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); timeCache.set(s, v); if (timeCache.size>400) timeCache.delete(timeCache.keys().next().value!); return v } catch { return '' }
  }

  function onPickEmoji(emojiChar: string) {
    const el = inputRef.value
    const pos = el?.selectionStart ?? input.value.length
    const res = emoji.insertEmoji(input.value, emojiChar, pos)
    input.value = res.text
    nextTick(() => { if (el) { el.focus(); el.setSelectionRange(res.cursor, res.cursor) } })
  }

  function onPickEmojiForEdit(emojiChar: string) {
    const el = editInputRef.value
    const pos = el?.selectionStart ?? chat.editingBody.value.length
    const res = emoji.insertEmoji(chat.editingBody.value, emojiChar, pos)
    chat.editingBody.value = res.text
    nextTick(() => { if (el) { el.focus(); el.setSelectionRange(res.cursor, res.cursor) } })
  }

  function handleStartEdit(m: any) {
    chat.startEdit(m)
    emoji.close()
    nextTick(() => editInputRef.value?.focus())
  }

  async function startChatWith(u: any) {
    if (u.can_message === false) {
      const reason = u.can_message_reason || 'Пользователь не принимает сообщения'
      if (reason.includes('заблокировал')) notifyBlockedBy(reason)
      else toast?.add({ severity: 'warn', summary: 'Нельзя написать', detail: reason, life: 3500 })
      return
    }
    creatingChat.value = true
    try {
      await chat.createConversation(u.id)
      tab.value = 'chats'
      chat.searchQuery.value = ''
      chat.searchResults.value = []
      focusChatInput()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Ошибка создания чата'
      if (e?.response?.status === 403 && msg.includes('заблокировал')) notifyBlockedBy(msg)
      else if (e?.response?.status === 403) toast?.add({ severity: 'warn', summary: 'Нельзя создать чат', detail: msg, life: 3500 })
      else toast?.add({ severity: 'error', summary: 'Ошибка', detail: msg, life: 3500 })
    } finally { creatingChat.value = false }
  }

  async function addFriendFromSearch(userId: number) {
    try {
      await friendsApi.add(userId)
      const item = chat.searchResults.value.find((u: any) => Number(u.id) === Number(userId))
      if (item) { item.is_pending = true }
    } catch (e: any) {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: e?.response?.data?.message || 'Не удалось отправить заявку', life: 3500 })
    }
  }

  async function savePrivacy() {
    await chatApi.updatePrivacy({ message_privacy: privacy.value.message_privacy })
  }

  function askBlock(userId: number, name?: string) {
    confirm.value = { type: 'block', payload: userId, title: 'Заблокировать?', msg: `Заблокировать ${name ?? 'пользователя'}? Чат и дружба будут удалены, сообщения скрыты.`, icon: '⛔', confirmLabel: 'Заблокировать', severity: 'danger' }
  }
  function askDeleteChat(id?: number) {
    const cid = id ?? chat.selectedId.value
    if (!cid) return
    confirm.value = { type: 'deleteChat', payload: cid, title: 'Удалить чат?', msg: 'Чат и все сообщения будут удалены навсегда. Это нельзя отменить.', icon: '🗑️', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askClearAllChats() {
    if (!chat.conversations.value.length) return
    confirm.value = { type: 'clearAllChats', payload: null, title: 'Удалить все чаты?', msg: 'Все диалоги пропадут из вашего списка навсегда, история будет очищена. У собеседников чаты останутся. Это нельзя отменить.', icon: '🗑️', confirmLabel: 'Удалить все', severity: 'danger' }
  }
  function askDeleteMessage(id: number) {
    confirm.value = { type: 'deleteMessage', payload: id, title: 'Удалить сообщение?', msg: 'Сообщение будет удалено у всех участников.', icon: '🗑️', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askRemoveFriend(f: any) {
    confirm.value = { type: 'removeFriend', payload: f, title: 'Удалить из друзей?', msg: `Удалить ${f?.other?.name ?? 'пользователя'} из друзей?`, icon: '👋', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askUnblock(userId: number) {
    confirm.value = { type: 'unblock', payload: userId, title: 'Разблокировать?', msg: 'Пользователь снова сможет писать вам.', icon: '🔓', confirmLabel: 'Разблокировать', severity: 'primary' }
  }
  async function doConfirm() {
    if (!confirm.value) return
    const { type, payload } = confirm.value
    confirm.value = null
    sheet.value = null
    if (type === 'block') {
      const conv = chat.conversations.value.find(c => c?.other?.id === payload)
      const friendEntry = friendsApi.friends.value.find(f => Number(f?.other?.id) === Number(payload))
      if (friendEntry) friendsApi.friends.value = friendsApi.friends.value.filter(f => f?.id !== friendEntry.id)
      if (conv) chat.conversations.value = chat.conversations.value.filter(c => c?.id !== conv.id)
      if (conv && chat.selectedId.value === conv.id) { chat.selectedId.value = null; chat.activeConv.value = null; chat.messages.value = [] }
      try {
        await blocksApi.block(payload)
        if (conv) { try { await chatApi.deleteConversation(conv.id) } catch {} }
      } catch (e) { await Promise.all([friendsApi.load(), blocksApi.load(), chat.loadConversations()]); throw e }
      friendsApi.load(); chat.loadConversations()
    } else if (type === 'deleteChat') {
      await chat.deleteConversation(payload)
    } else if (type === 'clearAllChats') {
      await chat.clearAllConversations()
    } else if (type === 'deleteMessage') {
      await chat.deleteMessage(payload)
    } else if (type === 'removeFriend') {
      await friendsApi.remove(payload.id)
    } else if (type === 'unblock') {
      await blocksApi.unblock(payload)
    }
  }

  function closeSheet() { sheet.value = null }

  watch(() => chat.selectedId.value, (id) => { reply.cancelReply(); voice.cancel(); voice.discardPreview(); if (id) focusChatInput() })

  function backToList() { nav.backToList(emoji.close, chat.cancelEdit, showChatMenu) }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && chat.selectedId.value) {
      if (emoji.open.value) { emoji.close(); return }
      if (chat.editingId.value !== null) { chat.cancelEdit(); return }
      if (reply.replyTo.value) { reply.cancelReply(); return }
      if (voice.isRecording.value) { voice.cancel(); return }
      if (voice.hasPreview.value) { voice.discardPreview(); return }
      if (showChatMenu.value) { showChatMenu.value = false; return }
      backToList()
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

  function focusChatInput() {
    nextTick(() => {
      const el: any = inputRef.value
      if (!el) return
      try {
        if (el.$el) {
          const inner = el.$el.querySelector?.('input')
          if (inner) { inner.focus(); return }
        }
        if (typeof el.focus === 'function') el.focus()
      } catch {}
    })
  }

  function resolveInitialId(): number | null {
    if (initialConversationId) return Number(initialConversationId)
    try {
      const q = new URLSearchParams(window.location.search).get('c')
      if (q && Number(q)) return Number(q)
    } catch {}
    return null
  }

  function resolveInitialTab() {
    try {
      const q = new URLSearchParams(window.location.search)
      const t = q.get('tab')
      if (t && ['chats', 'ulove', 'friends', 'requests', 'blocked'].includes(t)) tab.value = t as any
      else if (q.get('from') === 'swipes') tab.value = 'ulove'
    } catch {}
  }

  /**
   * Открыть диалог по id с понятной ошибкой.
   *
   * @param rawId id диалога из пропса или URL
   * @returns void
   */
  async function openTarget(rawId: number | string | null | undefined): Promise<void> {
    const targetId = Number(rawId)
    if (!targetId) return
    try {
      await chat.openConversation(targetId)
      const opened = chat.activeConv.value as any
      const isSos = String(opened?.type ?? 'direct') !== 'direct'
      tab.value = !isSos && opened?.other?.is_match ? 'ulove' : 'chats'
      focusChatInput()
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Не удалось открыть чат'
      toast?.add({ severity: 'error', summary: 'Чат не открылся', detail: msg, life: 4000 })
    }
  }

  async function init() {
    resolveInitialTab()
    badgeSync.init()
    const targetId = resolveInitialId()
    if (targetId) {
      await chat.loadConversations().catch(() => {})
      await openTarget(targetId)
    }
    try {
      await Promise.all([friendsApi.load(), blocksApi.load()])
    } catch {}
    badgeSync.setPending(friendsApi.pendingIn.value.length)
    try {
      await chat.loadConversations()
    } catch {}
    badgeSync.setUnread(chat.unreadTotal.value)
    badgeSync.setUnreadMessages(chat.unreadMessagesTotal.value)
    try { const me = await chatApi.me(); privacy.value.message_privacy = me.message_privacy ?? 'everyone' } catch {}
    if (targetId && !chat.selectedId.value) {
      await openTarget(targetId)
    }
  }

  return {
    chat, friendsApi, blocksApi, emoji, badgeSync, pins, togglePin, uloveConversations, uloveUnread, isBusiness,
    input, inputRef, editInputRef, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage, bindSheet, voice,
    handleSend, handlePickFile, handlePasteImage, handleShareLocation, handleStartVoice, handleStopVoice, handleCancelVoice, handleSendVoice, locating: chatLocation.locating, attachment, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, addFriendFromSearch, savePrivacy, doConfirm, closeSheet, backToList,
    askBlock, askDeleteChat, askClearAllChats, askDeleteMessage, askRemoveFriend, askUnblock,
    init, openTarget, reply, handleStartReply, jumpToMessage,
  }
}
