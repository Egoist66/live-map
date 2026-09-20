<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import Toast from 'primevue/toast'
import ChatSidebar from '@/Components/Features/Chat/ChatSidebar.vue'
import ChatWindow from '@/Components/Features/Chat/ChatWindow.vue'
// Диалоги открываются только по действию — грузим лениво, первым paint не блокируют.
const ChatSearchDialog = defineAsyncComponent(() => import('@/Components/Features/Chat/ChatSearchDialog.vue'))
const ChatConfirmDialog = defineAsyncComponent(() => import('@/Components/Features/Chat/ChatConfirmDialog.vue'))
const ChatBottomSheet = defineAsyncComponent(() => import('@/Components/Features/Chat/ChatBottomSheet.vue'))
const ChatWallpaperDialog = defineAsyncComponent(() => import('@/Components/Features/Chat/ChatWallpaperDialog.vue'))
const DistrictInviteDialog = defineAsyncComponent(() => import('@/Components/Features/Map/DistrictInviteDialog.vue'))
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { useChatOnline } from '@/composables/useChatOnline'
import { useChatPage } from '@/composables/useChatPage'
import { useChatFilters } from '@/composables/useChatFilters'
import { useChatDatingTheme } from '@/composables/useChatDatingTheme'
import { useChatMessageStatus } from '@/composables/useChatMessageStatus'
import { useChatViewport } from '@/composables/useChatViewport'
import { useChatWallpaper } from '@/composables/useChatWallpaper'
import { useChatLayout } from '@/composables/useChatLayout'
import { usePageScrollLock } from '@/composables/usePageScrollLock'
import { useDistrictInvite } from '@/composables/useDistrictInvite'
import { useToast } from 'primevue/usetoast'

usePageScrollLock()
const toast = (() => { try { return useToast() } catch { return null as any } })()
const districtInvite = useDistrictInvite()

/**
 * Открыть приглашение в район из чата (только владелец).
 */
function openDistrictInviteFromChat(conv: any): void {
  const districtId = Number(conv?.district_id) || 0
  if (!(districtId > 0)) {
    return
  }
  districtInvite.show(districtId, String(conv?.title ?? ''))
}

/**
 * Пригласить человека из чата района.
 *
 * @param userId кого зовём
 */
async function sendDistrictInviteFromChat(userId: number): Promise<void> {
  const ok = await districtInvite.invite(userId)
  if (!ok) {
    return
  }
  toast?.add({ severity: 'success', summary: 'Приглашён', detail: 'Человек сразу стал жителем района', life: 3000 })
}

const props = defineProps<{ conversationId?: number }>()
const {
  chat, friendsApi, blocksApi, emoji, pins, togglePin, uloveConversations, uloveUnread,
  input, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage,
  handleSend, handleShareLocation, locating, handlePickFile, handlePasteImage, attachment, voice, handleStartVoice, handleStopVoice, handleCancelVoice, handleSendVoice, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, addFriendFromSearch, savePrivacy, doConfirm, closeSheet, backToList, init, openTarget, reply, handleStartReply, jumpToMessage,
  askBlock, askDeleteChat, askClearAllChats, askDeleteMessage, askRemoveFriend, askUnblock,
} = useChatPage(props.conversationId)
const { conversations, activeConv, messages, loading, sending, refreshing, typingUsers, searchQuery, searchResults, searching, selectedId, unreadTotal, editingId, editingBody, refresh, openConversation, saveEdit, cancelEdit, notifyTyping, stopTyping } = chat
const setHistoryTop = (el: unknown): void => {
  try {
    chat.history.topSentinel.value = el as HTMLElement | null
    chat.history.ensureObserver()
  } catch { /* noop */ }
}
const { friends, pendingIn } = friendsApi
const convHasMore = computed(() => (chat as unknown as { conversationsHasMore?: { value: boolean } }).conversationsHasMore?.value ?? false)
const convLoadingMore = computed(() => (chat as unknown as { conversationsLoadingMore?: { value: boolean } }).conversationsLoadingMore?.value ?? false)
const { sentinel: convSentinel } = useInfiniteScroll({ hasMore: convHasMore, loading: convLoadingMore, onLoadMore: () => (chat as unknown as { loadMoreConversations: () => Promise<boolean> }).loadMoreConversations() })
const friendsHasMore = computed(() => friendsApi.hasMore.value)
const friendsLoadingMore = computed(() => friendsApi.loadingMore.value)
const { sentinel: friendsSentinel } = useInfiniteScroll({ hasMore: friendsHasMore, loading: friendsLoadingMore, onLoadMore: () => friendsApi.loadMore() })
const { blocked } = blocksApi
const { open: emojiOpen, toggle: toggleEmoji, EMOJI_GROUPS } = emoji
const { isOnline } = useChatOnline(chat, friendsApi)
const { keyboardHeight, isChatKeyboardOpen } = useChatViewport()
const filters = useChatFilters(chat, friendsApi, blocksApi)
const { messageStatus } = useChatMessageStatus(isOwnMessage)
const { pageClass, frameClass, frameStyle } = useChatLayout(keyboardHeight, isChatKeyboardOpen)
function closeConfirm() { confirm.value = null }
const datingTheme = useChatDatingTheme(chat.activeConv, chat.selectedId)
const wallpaper = useChatWallpaper()
const wallpaperOpen = ref(false)
void wallpaper.init()

watch(() => props.conversationId, (id) => { if (id) void openTarget(id) })
onMounted(async () => { await init(); datingTheme.checkEntry() })
</script>
<template>
  <Head title="Чаты" />
  <Toast />
    <div :class="pageClass">
      <div :class="frameClass" class="h-app-full" :style="frameStyle">
        <ChatSidebar :tab="tab" @update:tab="(v:any)=>tab=v" :unread-total="unreadTotal" :ulove-unread="uloveUnread" :pending-count="pendingIn.length" :blocked-count="blocked.length" :refreshing="refreshing" :conversations="(filters.filteredConversations.value as any)" :ulove-conversations="(uloveConversations as any)" :friends="(filters.filteredFriends.value as any)" :pending-in="(filters.filteredPendingIn.value as any)" :blocked="(filters.filteredBlocked.value as any)" :filter="filters.chatFilter.value" @update:filter="(v:string)=>filters.chatFilter.value=v" :selected-id="selectedId" :conversations-sentinel="convSentinel" :conversations-has-more="convHasMore" :conversations-loading-more="convLoadingMore" :friends-sentinel="friendsSentinel" :friends-has-more="friendsHasMore" :friends-loading-more="friendsLoadingMore" :privacy="privacy" :show-privacy="showPrivacy" @update:show-privacy="(v:boolean)=>showPrivacy=v" :is-online="isOnline" :format-time="formatTime" @refresh="refresh" @people="filters.showPeopleSearch.value = true" @open="openConversation" @start-chat="startChatWith" @delete-chat="askDeleteChat" @clear-all-chats="askClearAllChats" @block="askBlock" @unblock="askUnblock" @remove-friend="askRemoveFriend" @accept="(id:number)=>friendsApi.accept(id)" @decline="(id:number)=>friendsApi.decline(id)" @save-privacy="savePrivacy" />
        <ChatWindow :selected-id="selectedId" :active-conv="activeConv" :messages="messages" :loading="loading" :sending="sending" :refreshing="refreshing" :typing="[...typingUsers].some((id:any)=>id===activeConv?.other?.id)" :online="isOnline(activeConv?.other?.id, (activeConv?.other as any)?.last_seen_at)" :dating-entry="datingTheme.isDatingEntry.value" :dating-badge="datingTheme.badge.value" @swipes-back="datingTheme.backToSwipes()" :input="input" @update:input="(v:string)=>input=v" :emoji-open="emojiOpen" :emoji-groups="EMOJI_GROUPS" :editing-id="editingId" :editing-body="editingBody" @update:editing-body="(v:string)=>editingBody=v" :show-menu="showChatMenu" :keyboard-style="{}" :is-own-message="isOwnMessage" :message-status="messageStatus" :format-time="formatTime" :reply-to="reply.replyTo.value" :attachment-name="attachment.file.value?.name ?? null" :attachment-size="attachment.file.value?.size ?? null" :preview-url="attachment.previewUrl.value" :attach-error="attachment.error.value" :attaching="attachment.processing.value" :locating="locating" @send="handleSend" @share-location="handleShareLocation" @pick-file="handlePickFile" @paste-image="handlePasteImage" @remove-file="attachment.clear()" @typing="notifyTyping" @stop-typing="stopTyping" @refresh="refresh" @back="backToList" @close="backToList" @toggle-menu="showChatMenu = !showChatMenu" @menu-close="showChatMenu = false" @wallpaper="wallpaperOpen = true" @delete-chat="() => askDeleteChat()" @block="activeConv?.other && askBlock(activeConv.other.id, activeConv.other.name)" @toggle-emoji="toggleEmoji" @emoji-close="emoji.close()" @pick-emoji="onPickEmoji" @pick-emoji-edit="onPickEmojiForEdit" @start-edit="handleStartEdit" @save-edit="saveEdit" @cancel-edit="cancelEdit" @delete-message="askDeleteMessage" :pinned="pins.pinned.value" :pin-limit-label="pins.limitLabel()" :flash-id="pins.flashId.value" @toggle-pin="togglePin" @unpin="(id:number)=>pins.unpin(id)" @jump-to-message="jumpToMessage" @reply="handleStartReply" :voice-recording="voice.isRecording.value" :voice-duration="voice.duration.value" :voice-level="voice.level.value" :voice-error="voice.error.value" :voice-preview-url="voice.previewUrl.value" :voice-preview-duration="voice.previewDuration.value" :has-voice-preview="voice.hasPreview.value" @start-voice="handleStartVoice" @stop-voice="handleStopVoice" @cancel-voice="handleCancelVoice" @send-voice="handleSendVoice" @discard-voice="voice.discardPreview()" @cancel-reply="reply.cancelReply()" @invite-district="openDistrictInviteFromChat(activeConv)" :history-top-sentinel="setHistoryTop" :history-has-more="chat.history.hasMore.value" :history-loading="chat.history.loadingOlder.value" />
      </div>
    </div>
    <ChatSearchDialog :open="filters.showPeopleSearch.value" @update:open="(v:boolean)=>filters.showPeopleSearch.value=v" :query="searchQuery" @update:query="(v:string)=>searchQuery=v" :results="searchResults" :searching="searching" :creating="creatingChat" :is-online="isOnline" @chat="(u:any)=>{ startChatWith(u); filters.showPeopleSearch.value = false }" @add="addFriendFromSearch" @block="askBlock" />
    <ChatConfirmDialog :confirm="confirm" @close="closeConfirm" @ok="doConfirm" />
    <ChatWallpaperDialog :open="wallpaperOpen" @update:open="(v:boolean)=>wallpaperOpen=v" />
    <DistrictInviteDialog :open="districtInvite.open.value" @update:open="districtInvite.setOpen" :district-name="districtInvite.districtName.value" :query="districtInvite.query.value" @update:query="districtInvite.search" :results="districtInvite.results.value" :searching="districtInvite.searching.value" :inviting-id="districtInvite.invitingId.value" :error="districtInvite.error.value" @invite="sendDistrictInviteFromChat" />
    <ChatBottomSheet :sheet="sheet" :is-own-message="isOwnMessage" @close="closeSheet" @open-chat="openConversation" @start-chat="startChatWith" @edit="(m:any)=>{ closeSheet(); handleStartEdit(m) }" @delete-message="(id:number)=>{ closeSheet(); askDeleteMessage(id) }" @delete-chat="(id?:number)=>askDeleteChat(id)" @block="askBlock" @unblock="askUnblock" @remove-friend="askRemoveFriend" @accept="(id:number)=>{ closeSheet(); friendsApi.accept(id) }" @decline="(id:number)=>{ friendsApi.decline(id); closeSheet() }" @add="(id:number)=>{ closeSheet(); friendsApi.add(id) }" />
</template>
