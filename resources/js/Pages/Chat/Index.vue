<script setup lang="ts">
import { onMounted, watch } from 'vue'
import Toast from 'primevue/toast'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import ChatSidebar from '@/Components/Features/Chat/ChatSidebar.vue'
import ChatWindow from '@/Components/Features/Chat/ChatWindow.vue'
import ChatSearchDialog from '@/Components/Features/Chat/ChatSearchDialog.vue'
import ChatConfirmDialog from '@/Components/Features/Chat/ChatConfirmDialog.vue'
import ChatBottomSheet from '@/Components/Features/Chat/ChatBottomSheet.vue'
import { useChatOnline } from '@/composables/useChatOnline'
import { useChatPage } from '@/composables/useChatPage'
import { useChatFilters } from '@/composables/useChatFilters'
import { useChatDatingTheme } from '@/composables/useChatDatingTheme'
import { useChatMessageStatus } from '@/composables/useChatMessageStatus'
import { useChatViewport } from '@/composables/useChatViewport'
import { useChatLayout } from '@/composables/useChatLayout'
import { usePageScrollLock } from '@/composables/usePageScrollLock'

usePageScrollLock()

const props = defineProps<{ conversationId?: number }>()
const {
  chat, friendsApi, blocksApi, emoji, pins, togglePin, uloveConversations, uloveUnread,
  input, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage,
  handleSend, handleShareLocation, locating, handlePickFile, handlePasteImage, attachment, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, addFriendFromSearch, savePrivacy, doConfirm, closeSheet, backToList, init, openTarget, reply, handleStartReply, jumpToMessage,
  askBlock, askDeleteChat, askClearAllChats, askDeleteMessage, askRemoveFriend, askUnblock,
} = useChatPage(props.conversationId)
const { conversations, activeConv, messages, loading, sending, refreshing, typingUsers, searchQuery, searchResults, searching, selectedId, unreadTotal, editingId, editingBody, refresh, openConversation, saveEdit, cancelEdit, notifyTyping, stopTyping } = chat
const { friends, pendingIn } = friendsApi
const { blocked } = blocksApi
const { open: emojiOpen, toggle: toggleEmoji, EMOJI_GROUPS } = emoji
const { isOnline } = useChatOnline(chat, friendsApi)
const { keyboardHeight, isChatKeyboardOpen } = useChatViewport()
const filters = useChatFilters(chat, friendsApi, blocksApi)
const { messageStatus } = useChatMessageStatus(isOwnMessage)
const { pageClass, frameClass } = useChatLayout()
function closeConfirm() { confirm.value = null }
const datingTheme = useChatDatingTheme(chat.activeConv, chat.selectedId)

watch(() => props.conversationId, (id) => { if (id) void openTarget(id) })
onMounted(async () => { await init(); datingTheme.checkEntry() })
</script>
<template>
  <AuthenticatedLayout>
    <Toast />
    <div :class="pageClass">
      <div :class="frameClass" class="h-[calc(100dvh-56px-60px-env(safe-area-inset-bottom,0px))] max-h-[calc(100dvh-56px-60px-env(safe-area-inset-bottom,0px))] min-[411px]:h-[calc(100dvh-64px-60px-env(safe-area-inset-bottom,0px))] min-[411px]:max-h-[calc(100dvh-64px-60px-env(safe-area-inset-bottom,0px))] lg:h-[calc(100dvh-64px-32px)] lg:max-h-[calc(100dvh-64px-32px)]" :style="isChatKeyboardOpen ? { height: `calc(100dvh - 64px - ${keyboardHeight}px)`, maxHeight: `calc(100dvh - 64px - ${keyboardHeight}px)` } : {}">
        <ChatSidebar :tab="tab" @update:tab="(v:any)=>tab=v" :unread-total="unreadTotal" :ulove-unread="uloveUnread" :pending-count="pendingIn.length" :blocked-count="blocked.length" :refreshing="refreshing" :conversations="(filters.filteredConversations.value as any)" :ulove-conversations="(uloveConversations as any)" :friends="(filters.filteredFriends.value as any)" :pending-in="(filters.filteredPendingIn.value as any)" :blocked="(filters.filteredBlocked.value as any)" :filter="filters.chatFilter.value" @update:filter="(v:string)=>filters.chatFilter.value=v" :selected-id="selectedId" :privacy="privacy" :show-privacy="showPrivacy" @update:show-privacy="(v:boolean)=>showPrivacy=v" :is-online="isOnline" :format-time="formatTime" @refresh="refresh" @people="filters.showPeopleSearch.value = true" @open="openConversation" @start-chat="startChatWith" @delete-chat="askDeleteChat" @clear-all-chats="askClearAllChats" @block="askBlock" @unblock="askUnblock" @remove-friend="askRemoveFriend" @accept="(id:number)=>friendsApi.accept(id)" @decline="(id:number)=>friendsApi.decline(id)" @save-privacy="savePrivacy" />
        <ChatWindow :selected-id="selectedId" :active-conv="activeConv" :messages="messages" :loading="loading" :sending="sending" :refreshing="refreshing" :typing="[...typingUsers].some((id:any)=>id===activeConv?.other?.id)" :online="isOnline(activeConv?.other?.id, (activeConv?.other as any)?.last_seen_at)" :dating-entry="datingTheme.isDatingEntry.value" :dating-badge="datingTheme.badge.value" @swipes-back="datingTheme.backToSwipes()" :input="input" @update:input="(v:string)=>input=v" :emoji-open="emojiOpen" :emoji-groups="EMOJI_GROUPS" :editing-id="editingId" :editing-body="editingBody" @update:editing-body="(v:string)=>editingBody=v" :show-menu="showChatMenu" :keyboard-style="{}" :is-own-message="isOwnMessage" :message-status="messageStatus" :format-time="formatTime" :reply-to="reply.replyTo.value" :attachment-name="attachment.file.value?.name ?? null" :attachment-size="attachment.file.value?.size ?? null" :preview-url="attachment.previewUrl.value" :attach-error="attachment.error.value" :attaching="attachment.processing.value" :locating="locating" @send="handleSend" @share-location="handleShareLocation" @pick-file="handlePickFile" @paste-image="handlePasteImage" @remove-file="attachment.clear()" @typing="notifyTyping" @stop-typing="stopTyping" @refresh="refresh" @back="backToList" @close="backToList" @toggle-menu="showChatMenu = !showChatMenu" @menu-close="showChatMenu = false" @delete-chat="() => askDeleteChat()" @block="activeConv?.other && askBlock(activeConv.other.id, activeConv.other.name)" @toggle-emoji="toggleEmoji" @emoji-close="emoji.close()" @pick-emoji="onPickEmoji" @pick-emoji-edit="onPickEmojiForEdit" @start-edit="handleStartEdit" @save-edit="saveEdit" @cancel-edit="cancelEdit" @delete-message="askDeleteMessage" :pinned="pins.pinned.value" :pin-limit-label="pins.limitLabel()" :flash-id="pins.flashId.value" @toggle-pin="togglePin" @unpin="(id:number)=>pins.unpin(id)" @jump-to-message="jumpToMessage" @reply="handleStartReply" @cancel-reply="reply.cancelReply()" />
      </div>
    </div>
    <ChatSearchDialog :open="filters.showPeopleSearch.value" @update:open="(v:boolean)=>filters.showPeopleSearch.value=v" :query="searchQuery" @update:query="(v:string)=>searchQuery=v" :results="searchResults" :searching="searching" :creating="creatingChat" :is-online="isOnline" @chat="(u:any)=>{ startChatWith(u); filters.showPeopleSearch.value = false }" @add="addFriendFromSearch" @block="askBlock" />
    <ChatConfirmDialog :confirm="confirm" @close="closeConfirm" @ok="doConfirm" />
    <ChatBottomSheet :sheet="sheet" :is-own-message="isOwnMessage" @close="closeSheet" @open-chat="openConversation" @start-chat="startChatWith" @edit="(m:any)=>{ closeSheet(); handleStartEdit(m) }" @delete-message="(id:number)=>{ closeSheet(); askDeleteMessage(id) }" @delete-chat="(id?:number)=>askDeleteChat(id)" @block="askBlock" @unblock="askUnblock" @remove-friend="askRemoveFriend" @accept="(id:number)=>{ closeSheet(); friendsApi.accept(id) }" @decline="(id:number)=>{ friendsApi.decline(id); closeSheet() }" @add="(id:number)=>{ closeSheet(); friendsApi.add(id) }" />
  </AuthenticatedLayout>
</template>
