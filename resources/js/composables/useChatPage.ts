import { ref, computed, nextTick } from 'vue'
import { usePage } from '@inertiajs/vue3'
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
  const pageProps = usePage().props as any
  const isOwnMessage = (m: any) => Number(m.sender_id) === Number(pageProps.auth?.user?.id)
  const { bind: bindSheet } = useLongPress((p: any) => { sheet.value = p }, 520)

  async function handleSend() {
    if (!input.value.trim()) return
    const txt = input.value
    input.value = ''
    emoji.close()
    await chat.sendMessage(txt)
  }

  function formatTime(s: string) {
    try { return new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) } catch { return s }
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
    if (u.can_message === false) return alert(u.can_message_reason || 'Пользователь не принимает сообщения')
    creatingChat.value = true
    try {
      await chat.createConversation(u.id)
      tab.value = 'chats'
      chat.searchQuery.value = ''
      chat.searchResults.value = []
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Ошибка создания чата')
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
      await blocksApi.block(payload)
      const conv = chat.conversations.value.find(c => c.other?.id === payload)
      if (conv) await chat.deleteConversation(conv.id)
      await friendsApi.load(); await blocksApi.load()
    } else if (type === 'deleteChat') {
      await chat.deleteConversation(payload)
    } else if (type === 'deleteMessage') {
      await chat.deleteMessage(payload)
    } else if (type === 'removeFriend') {
      await friendsApi.remove(payload.id)
    } else if (type === 'unblock') {
      await blocksApi.unblock(payload); await blocksApi.load()
    }
  }

  function closeSheet() { sheet.value = null }

  function backToList() { nav.backToList(emoji.close, chat.cancelEdit, showChatMenu) }

  async function init() {
    badgeSync.init()
    await Promise.all([friendsApi.load(), blocksApi.load()])
    badgeSync.setPending(friendsApi.pendingIn.value.length)
    await chat.loadConversations()
    badgeSync.setUnread(chat.unreadTotal.value)
    try { const me = await chatApi.me(); privacy.value.message_privacy = me.message_privacy; privacy.value.allow_random_messages = me.allow_random_messages } catch {}
    if (initialConversationId) chat.openConversation(initialConversationId)
  }

  return {
    chat, friendsApi, blocksApi, emoji, badgeSync,
    input, inputRef, editInputRef, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage, bindSheet,
    handleSend, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, savePrivacy, doConfirm, closeSheet, backToList,
    askBlock, askDeleteChat, askDeleteMessage, askRemoveFriend, askUnblock,
    init,
  }
}
