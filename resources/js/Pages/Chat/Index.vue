<script setup lang="ts">
import { onMounted } from 'vue'
import Toast from 'primevue/toast'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import ChatSidebar from '@/Components/Chat/ChatSidebar.vue'
import ChatWindow from '@/Components/Chat/ChatWindow.vue'
import ChatSearchDialog from '@/Components/Chat/ChatSearchDialog.vue'
import ChatConfirmDialog from '@/Components/Chat/ChatConfirmDialog.vue'
import ChatBottomSheet from '@/Components/Chat/ChatBottomSheet.vue'
import { usePresenceState } from '@/composables/usePresence'
import { useChatPage } from '@/composables/useChatPage'
import { useChatFilters } from '@/composables/useChatFilters'
import { useChatMessageStatus } from '@/composables/useChatMessageStatus'
import { useChatViewport } from '@/composables/useChatViewport'

const props = defineProps<{ conversationId?: number }>()
const {
  chat, friendsApi, blocksApi, emoji,
  input, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage,
  handleSend, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, savePrivacy, doConfirm, closeSheet, backToList, init,
  askBlock, askDeleteChat, askDeleteMessage, askRemoveFriend, askUnblock,
} = useChatPage(props.conversationId)
const { conversations, activeConv, messages, loading, sending, refreshing, typingUsers, searchQuery, searchResults, searching, selectedId, unreadTotal, editingId, editingBody, refresh, openConversation, saveEdit, cancelEdit, notifyTyping, stopTyping } = chat
const { friends, pendingIn } = friendsApi
const { blocked } = blocksApi
const { open: emojiOpen, toggle: toggleEmoji, EMOJI_GROUPS } = emoji
const { isOnline } = usePresenceState()
const { keyboardHeight, isKeyboardOpen } = useChatViewport()
const filters = useChatFilters(chat, friendsApi, blocksApi)
const { messageStatus } = useChatMessageStatus(isOwnMessage)
function closeConfirm() { confirm.value = null }

onMounted(init)
</script>
<template>
  <AuthenticatedLayout>
    <Toast />
    <div class="mx-auto max-w-[1280px] lg:px-6 lg:py-4 w-full max-w-full min-w-0 overflow-hidden">
      <div class="flex flex-col lg:flex-row lg:gap-4 h-[calc(100dvh-64px-56px-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-64px-24px)] max-h-[calc(100dvh-64px-56px-env(safe-area-inset-bottom))] lg:max-h-[calc(100dvh-64px-24px)] bg-stone-100 dark:bg-zinc-950 lg:bg-transparent overflow-hidden lg:overflow-visible w-full max-w-full min-w-0" :style="isKeyboardOpen ? { height: `calc(100dvh - 64px - ${keyboardHeight}px)`, maxHeight: `calc(100dvh - 64px - ${keyboardHeight}px)` } : {}">
        <ChatSidebar :tab="tab" @update:tab="(v:any)=>tab=v" :unread-total="unreadTotal" :pending-count="pendingIn.length" :blocked-count="blocked.length" :refreshing="refreshing" :conversations="(filters.filteredConversations as any)" :friends="(filters.filteredFriends as any)" :pending-in="(filters.filteredPendingIn as any)" :blocked="(filters.filteredBlocked as any)" :filter="filters.chatFilter.value" @update:filter="(v:string)=>filters.chatFilter.value=v" :selected-id="selectedId" :privacy="privacy" :show-privacy="showPrivacy" @update:show-privacy="(v:boolean)=>showPrivacy=v" :is-online="isOnline" :format-time="formatTime" @refresh="refresh" @people="filters.showPeopleSearch.value = true" @open="openConversation" @start-chat="startChatWith" @delete-chat="askDeleteChat" @block="askBlock" @unblock="askUnblock" @remove-friend="askRemoveFriend" @accept="(id:number)=>friendsApi.accept(id)" @decline="(id:number)=>friendsApi.decline(id)" @save-privacy="savePrivacy" />
        <ChatWindow :selected-id="selectedId" :active-conv="activeConv" :messages="messages" :loading="loading" :sending="sending" :refreshing="refreshing" :typing="[...typingUsers].some((id:any)=>id===activeConv?.other?.id)" :online="isOnline(activeConv?.other?.id)" :input="input" @update:input="(v:string)=>input=v" :emoji-open="emojiOpen" :emoji-groups="EMOJI_GROUPS" :editing-id="editingId" :editing-body="editingBody" @update:editing-body="(v:string)=>editingBody=v" :show-menu="showChatMenu" :keyboard-style="{}" :is-own-message="isOwnMessage" :message-status="messageStatus" :format-time="formatTime" @send="handleSend" @typing="notifyTyping" @stop-typing="stopTyping" @refresh="refresh" @back="backToList" @close="backToList" @toggle-menu="showChatMenu = !showChatMenu" @menu-close="showChatMenu = false" @delete-chat="() => askDeleteChat()" @block="activeConv?.other && askBlock(activeConv.other.id, activeConv.other.name)" @toggle-emoji="toggleEmoji" @emoji-close="emoji.close()" @pick-emoji="onPickEmoji" @pick-emoji-edit="onPickEmojiForEdit" @start-edit="handleStartEdit" @save-edit="saveEdit" @cancel-edit="cancelEdit" @delete-message="askDeleteMessage" />
      </div>
    </div>
    <ChatSearchDialog :open="filters.showPeopleSearch.value" @update:open="(v:boolean)=>filters.showPeopleSearch.value=v" :query="searchQuery" @update:query="(v:string)=>searchQuery=v" :results="searchResults" :searching="searching" :creating="creatingChat" :is-online="isOnline" @chat="(u:any)=>{ startChatWith(u); filters.showPeopleSearch.value = false }" @add="(id:number)=>friendsApi.add(id)" @block="askBlock" />
    <ChatConfirmDialog :confirm="confirm" @close="closeConfirm" @ok="doConfirm" />
    <ChatBottomSheet :sheet="sheet" :is-own-message="isOwnMessage" @close="closeSheet" @open-chat="openConversation" @start-chat="startChatWith" @edit="(m:any)=>{ closeSheet(); handleStartEdit(m) }" @delete-message="(id:number)=>{ closeSheet(); askDeleteMessage(id) }" @delete-chat="(id?:number)=>askDeleteChat(id)" @block="askBlock" @unblock="askUnblock" @remove-friend="askRemoveFriend" @accept="(id:number)=>{ closeSheet(); friendsApi.accept(id) }" @decline="(id:number)=>{ friendsApi.decline(id); closeSheet() }" @add="(id:number)=>{ closeSheet(); friendsApi.add(id) }" />
  </AuthenticatedLayout>
</template>
