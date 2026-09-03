import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useChat } from '@/composables/useChat'
import { useFriendships } from '@/composables/useFriendships'
import { useBlocks } from '@/composables/useBlocks'
import { useEmojiPicker } from '@/composables/useEmojiPicker'
import { useLongPress } from '@/composables/useLongPress'
import { useChatBadges } from '@/composables/useChatBadges'
import { useChatNavigation } from '@/composables/useChatNavigation'
import { chatApi } from '@/services/chat.api'

export function useChatPage(initialConversationId?: number) {
  const chat = useChat()
  const friendsApi = useFriendships()
  const blocksApi = useBlocks()
  const emoji = useEmojiPicker()
  const badgeSync = useChatBadges(chat.unreadTotal, friendsApi.pendingIn)
  const nav = useChatNavigation(chat.selectedId, chat.openConversation)

  const input = ref('')
  const inputRef = ref<HTMLInputElement | null>(null)
  const editInputRef = ref<HTMLInputElement | null>(null)
  const tab = ref<'chats' | 'friends' | 'requests' | 'blocked'>('chats')
  const showChatMenu = ref(false)
  const sheet = ref<{ type: 'message' | 'chat' | 'friend' | 'request' | 'search', data: any } | null>(null)
  const showPrivacy = ref(false)
  const privacy = ref({ message_privacy: 'everyone', allow_random_messages: true })
  const creatingChat = ref(false)
  const confirm = ref<{ type: 'block' | 'deleteChat' | 'deleteMessage' | 'removeFriend' | 'unblock', payload: any, title: string, msg: string, icon: string, confirmLabel: string, severity: 'danger' | 'primary' } | null>(null)
  const confirmVisible = computed({ get: () => !!confirm.value, set: (v) => { if (!v) confirm.value = null } })
  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const pageProps = usePage().props as any
  const isOwnMessage = (m: any) => Number(m.sender_id) === Number(pageProps.auth?.user?.id)
  const { bind: bindSheet } = useLongPress((p: any) => { sheet.value = p }, 520)

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
    if (!input.value.trim()) return
    const txt = input.value
    input.value = ''
    emoji.close()
    try {
      await chat.sendMessage(txt)
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message || e?.message || ''
      input.value = txt
      if (status === 403 && msg.includes('заблокировал')) notifyBlockedBy(msg)
      else if (status === 403) toast?.add({ severity: 'warn', summary: 'Нельзя отправить', detail: msg || 'Сообщение не доставлено', life: 3500 })
      else if (msg) toast?.add({ severity: 'error', summary: 'Ошибка', detail: msg, life: 3500 })
    }
  }

  const timeCache = new Map<string,string>()
  function formatTime(s: string) {
    if (timeCache.has(s)) return timeCache.get(s)!
    try { const v = new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); timeCache.set(s, v); if (timeCache.size>400) timeCache.delete(timeCache.keys().next().value!); return v } catch { return s }
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

  async function savePrivacy() {
    await chatApi.updatePrivacy(privacy.value as any)
  }

  function askBlock(userId: number, name?: string) {
    confirm.value = { type: 'block', payload: userId, title: 'Заблокировать?', msg: `Заблокировать ${name ?? 'пользователя'}? Чат и дружба будут удалены, сообщения скрыты.`, icon: '⛔', confirmLabel: 'Заблокировать', severity: 'danger' }
  }
  function askDeleteChat(id?: number) {
    const cid = id ?? chat.selectedId.value
    if (!cid) return
    confirm.value = { type: 'deleteChat', payload: cid, title: 'Удалить чат?', msg: 'Чат и все сообщения будут удалены навсегда. Это нельзя отменить.', icon: '🗑️', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askDeleteMessage(id: number) {
    confirm.value = { type: 'deleteMessage', payload: id, title: 'Удалить сообщение?', msg: 'Сообщение будет удалено у всех участников.', icon: '🗑️', confirmLabel: 'Удалить', severity: 'danger' }
  }
  function askRemoveFriend(f: any) {
    confirm.value = { type: 'removeFriend', payload: f, title: 'Удалить из друзей?', msg: `Удалить ${f.other.name} из друзей?`, icon: '👋', confirmLabel: 'Удалить', severity: 'danger' }
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
      const conv = chat.conversations.value.find(c => c.other?.id === payload)
      const friendEntry = friendsApi.friends.value.find(f => Number(f.other?.id) === Number(payload))
      if (friendEntry) friendsApi.friends.value = friendsApi.friends.value.filter(f => f.id !== friendEntry.id)
      if (conv) chat.conversations.value = chat.conversations.value.filter(c => c.id !== conv.id)
      if (conv && chat.selectedId.value === conv.id) { chat.selectedId.value = null; chat.activeConv.value = null; chat.messages.value = [] }
      try {
        await blocksApi.block(payload)
        if (conv) { try { await chatApi.deleteConversation(conv.id) } catch {} }
      } catch (e) { await Promise.all([friendsApi.load(), blocksApi.load(), chat.loadConversations()]); throw e }
      friendsApi.load(); chat.loadConversations()
    } else if (type === 'deleteChat') {
      await chat.deleteConversation(payload)
    } else if (type === 'deleteMessage') {
      await chat.deleteMessage(payload)
    } else if (type === 'removeFriend') {
      await friendsApi.remove(payload.id)
    } else if (type === 'unblock') {
      await blocksApi.unblock(payload)
    }
  }

  function closeSheet() { sheet.value = null }

  watch(() => chat.selectedId.value, (id) => { if (id) focusChatInput() })

  function backToList() { nav.backToList(emoji.close, chat.cancelEdit, showChatMenu) }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && chat.selectedId.value) {
      if (emoji.open.value) { emoji.close(); return }
      if (chat.editingId.value !== null) { chat.cancelEdit(); return }
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
      const t = new URLSearchParams(window.location.search).get('tab')
      if (t && ['chats', 'friends', 'requests', 'blocked'].includes(t)) tab.value = t as any
    } catch {}
  }

  async function init() {
    resolveInitialTab()
    badgeSync.init()
    await Promise.all([friendsApi.load(), blocksApi.load()])
    badgeSync.setPending(friendsApi.pendingIn.value.length)
    await chat.loadConversations()
    badgeSync.setUnread(chat.unreadTotal.value)
    try { const me = await chatApi.me(); privacy.value.message_privacy = me.message_privacy; privacy.value.allow_random_messages = me.allow_random_messages } catch {}
    const targetId = resolveInitialId()
    if (targetId) {
      await chat.openConversation(targetId)
      tab.value = 'chats'
      focusChatInput()
      chat.loadConversations()
    }
  }

  return {
    chat, friendsApi, blocksApi, emoji, badgeSync,
    input, inputRef, editInputRef, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage, bindSheet,
    handleSend, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, savePrivacy, doConfirm, closeSheet, backToList,
    askBlock, askDeleteChat, askDeleteMessage, askRemoveFriend, askUnblock,
    init,
  }
}
