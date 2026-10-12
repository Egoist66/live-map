<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from "vue";
import { Head } from "@inertiajs/vue3";
import Toast from "primevue/toast";
import ChatSidebar from "@/Components/Features/Chat/ChatSidebar.vue";
import ChatWindow from "@/Components/Features/Chat/ChatWindow.vue";
import SavedNotesChat from "@/Components/Features/Chat/SavedNotesChat.vue";
// Диалоги открываются только по действию — грузим лениво, первым paint не блокируют.
const ChatSearchDialog = defineAsyncComponent(
  () => import("@/Components/Features/Chat/ChatSearchDialog.vue")
);
const ChatConfirmDialog = defineAsyncComponent(
  () => import("@/Components/Features/Chat/ChatConfirmDialog.vue")
);
const ChatBottomSheet = defineAsyncComponent(
  () => import("@/Components/Features/Chat/ChatBottomSheet.vue")
);
const ChatWallpaperDialog = defineAsyncComponent(
  () => import("@/Components/Features/Chat/ChatWallpaperDialog.vue")
);
const ChatPresetsDialog = defineAsyncComponent(
  () => import("@/Components/Features/Chat/ChatPresetsDialog.vue")
);
const ChatAutoReplyDialog = defineAsyncComponent(
  () => import("@/Components/Features/Chat/ChatAutoReplyDialog.vue")
);
const DistrictInviteDialog = defineAsyncComponent(
  () => import("@/Components/Features/Map/DistrictInviteDialog.vue")
);
const MessageForwardDialog = defineAsyncComponent(
  () => import("@/Components/Features/Chat/MessageForwardDialog.vue")
);
const ReportDialog = defineAsyncComponent(
  () => import("@/Components/Features/Map/ReportDialog.vue")
);
import { useInfiniteScroll } from "@/composables/useInfiniteScroll";
import { useReportDialog } from "@/composables/useReportDialog";
import { useChatOnline } from "@/composables/useChatOnline";
import { useChatPage } from "@/composables/useChatPage";
import { useChatFilters } from "@/composables/useChatFilters";
import { useChatDatingTheme } from "@/composables/useChatDatingTheme";

import { useChatMessageStatus } from "@/composables/useChatMessageStatus";
import { useChatViewport } from "@/composables/useChatViewport";
import { useChatWallpaper } from "@/composables/useChatWallpaper";
import { useChatLayout } from "@/composables/useChatLayout";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { useDistrictInvite } from "@/composables/useDistrictInvite";
import { useSavedNotesView } from "@/composables/useSavedNotesView";
import { useToast } from "primevue/usetoast";

usePageScrollLock();
const toast = (() => {
  try {
    return useToast();
  } catch {
    return null as any;
  }
})();
const districtInvite = useDistrictInvite();
const reportDialog = useReportDialog();

/**
 * Открыть приглашение в район из чата (только владелец).
 */
function openDistrictInviteFromChat(conv: any): void {
  const districtId = Number(conv?.district_id) || 0;
  if (!(districtId > 0)) {
    return;
  }
  districtInvite.show(districtId, String(conv?.title ?? ""));
}

/**
 * Пригласить человека из чата района.
 *
 * @param userId кого зовём
 */
async function sendDistrictInviteFromChat(userId: number): Promise<void> {
  const ok = await districtInvite.invite(userId);
  if (!ok) {
    return;
  }
  toast?.add({
    severity: "success",
    summary: "Приглашён",
    detail: "Человек сразу стал жителем района",
    life: 3000,
  });
}

const props = defineProps<{ conversationId?: number }>();
const {
  chat,
  friendsApi,
  blocksApi,
  emoji,
  pins,
  togglePin,
  uloveConversations,
  uloveUnread,
  isBusiness,
  uloveOnly,
  input,
  tab,
  showChatMenu,
  sheet,
  showPrivacy,
  privacy,
  creatingChat,
  confirm,
  confirmVisible,
  isOwnMessage,
  handleSend,
  handleShareLocation,
  locating,
  handlePickFile,
  handlePasteImage,
  attachment,
  voice,
  handleStartVoice,
  handleStopVoice,
  handleCancelVoice,
  handleSendVoice,
  formatTime,
  onPickEmoji,
  onPickEmojiForEdit,
  handleStartEdit,
  startChatWith,
  addFriendFromSearch,
  savePrivacy,
  doConfirm,
  closeSheet,
  backToList,
  init,
  openTarget,
  reply,
  handleStartReply,
  jumpToMessage,
  askBlock,
  askDeleteChat,
  askClearAllChats,
  askDeleteMessage,
  askDeleteSelection,
  askRemoveFriend,
  askUnblock,
  toggleChatPin,
  selection,
  canDeleteSelection,
  forwardOpen,
  forwarding,
  forwardingTargetId,
  forwardSources,
  toggleSelectMessage,
  cancelSelection,
  openForward,
  forwardSelection,
} = useChatPage(props.conversationId);
const {
  conversations,
  activeConv,
  messages,
  loading,
  sending,
  refreshing,
  typingUsers,
  searchQuery,
  searchResults,
  searching,
  selectedId,
  unreadTotal,
  editingId,
  editingBody,
  refresh,
  openConversation,
  saveEdit,
  cancelEdit,
  notifyTyping,
  stopTyping,
} = chat;
const setHistoryTop = (el: unknown): void => {
  try {
    chat.history.topSentinel.value = el as HTMLElement | null;
    chat.history.ensureObserver();
  } catch {
    /* noop */
  }
};
const { friends, pendingIn } = friendsApi;
const convHasMore = computed(
  () =>
    ((chat as unknown) as { conversationsHasMore?: { value: boolean } })
      .conversationsHasMore?.value ?? false
);
const convLoadingMore = computed(
  () =>
    ((chat as unknown) as { conversationsLoadingMore?: { value: boolean } })
      .conversationsLoadingMore?.value ?? false
);
const { sentinel: convSentinel } = useInfiniteScroll({
  hasMore: convHasMore,
  loading: convLoadingMore,
  onLoadMore: () =>
    ((chat as unknown) as {
      loadMoreConversations: () => Promise<boolean>;
    }).loadMoreConversations(),
});
const friendsHasMore = computed(() => friendsApi.hasMore.value);
const friendsLoadingMore = computed(() => friendsApi.loadingMore.value);
const { sentinel: friendsSentinel } = useInfiniteScroll({
  hasMore: friendsHasMore,
  loading: friendsLoadingMore,
  onLoadMore: () => friendsApi.loadMore(),
});
const { blocked } = blocksApi;
const { open: emojiOpen, toggle: toggleEmoji, EMOJI_GROUPS } = emoji;
const { isOnline } = useChatOnline(chat, friendsApi);
const { keyboardHeight, isChatKeyboardOpen } = useChatViewport();
const filters = useChatFilters(chat, friendsApi, blocksApi);
const { messageStatus } = useChatMessageStatus(isOwnMessage);
const { pageClass, frameClass, frameStyle } = useChatLayout(
  keyboardHeight,
  isChatKeyboardOpen
);
function closeConfirm() {
  confirm.value = null;
}
const datingTheme = useChatDatingTheme(chat.activeConv, chat.selectedId);

const wallpaper = useChatWallpaper();
const wallpaperOpen = ref(false);

/**
 * Общий фон беседы: привязка к открытому диалогу.
 * Следим за самим объектом, а не только за id: при открытии activeConv
 * сначала собирается из кэша списка (без фона), а detail с фоном
 * приезжает позже тем же id — по id вотчер бы не стрельнул второй раз.
 * Смена любым собеседником прилетает сокетом/поллингом сама.
 */
watch(
  () => activeConv.value as any,
  () => {
    wallpaper.bindConversation(
      Number((activeConv.value as any)?.id) || null,
      (activeConv.value as any)?.wallpaper
    );
  },
  { immediate: true }
);

const presetsOpen = ref(false);
const autoReplyOpen = ref(false);
const savedView = useSavedNotesView();
const isSavedOpen = savedView.isSavedOpen;

/**
 * Открыть «Избранное» как обычный чат: закрываем диалог с человеком,
 * показываем SavedNotesChat в центральной колонке.
 */
function goNotes(): void {
  selectedId.value = null;
  (activeConv as any).value = null;
  (messages as any).value = [];
  savedView.open();
}

/**
 * Закрыть «Избранное» — вернуться к списку (мобила) / плейсхолдеру (десктоп).
 */
function closeNotes(): void {
  savedView.close();
}

/**
 * Открыть диалог с человеком: избранное закрывается (взаимное исключение).
 * @param id id диалога
 */
async function openConversationAsChat(id: number): Promise<void> {
  savedView.close();
  await openConversation(id);
}

/**
 * Назад к списку: закрывает и диалог, и избранное.
 */
function backToChatList(): void {
  savedView.close();
  backToList();
}

/**
 * Начать чат с человеком из поиска/друзей: избранное закрывается.
 * @param user пользователь для диалога
 */
async function startChatAsChat(user: any): Promise<void> {
  savedView.close();
  await startChatWith(user);
}

/**
 * Подставить пресет в поле ввода (через пробел к черновику).
 * @param text текст пресета
 */
function insertPreset(text: string): void {
  const clean = text.trim();
  if (!clean) return;
  input.value =
    input.value.trim() === "" ? clean : `${input.value.replace(/\s+$/u, "")} ${clean}`;
}

/**
 * Отправить пресет сразу, не трогая черновик.
 * @param text текст пресета
 */
async function sendPreset(text: string): Promise<void> {
  const clean = text.trim();
  if (!clean || !selectedId.value) {
    insertPreset(clean);
    return;
  }
  const quoted = reply.replyTo.value;
  try {
    await chat.sendMessage(clean, quoted);
    reply.cancelReply();
  } catch (e: any) {
    const msg = e?.response?.data?.message || "Не удалось отправить пресет";
    toast?.add({ severity: "error", summary: "Не отправлено", detail: msg, life: 3500 });
  }
}

/**
 * Тост после сохранения автоответа.
 * @param enabled включён ли автоответ
 */
function onAutoReplySaved(enabled: boolean): void {
  toast?.add({
    severity: enabled ? "success" : "info",
    summary: enabled ? "Автоответ включён" : "Автоответ выключен",
    detail: enabled
      ? "Когда тебя нет онлайн, собеседник получит сообщение, а тебе придёт пинг на email."
      : "Автоответ больше не отправляется.",
    life: 4000,
  });
}

watch(
  () => props.conversationId,
  (id) => {
    if (id) {
      savedView.close();
      void openTarget(id);
    }
  }
);
onMounted(async () => {
  await init();
  if (!isBusiness.value) {
    datingTheme.checkEntry();
  }
});
</script>
<template>
  <Head title="Чаты" />
  <Toast />
  <div :class="pageClass">
    <div :class="frameClass" class="h-app-full" :style="frameStyle">
      <ChatSidebar
        :tab="tab"
        @update:tab="(v: any) => tab = v"
        :is-business="isBusiness"
        :ulove-only="uloveOnly"
        :unread-total="unreadTotal"
        :ulove-unread="uloveUnread"
        :pending-count="pendingIn.length"
        :blocked-count="blocked.length"
        :refreshing="refreshing"
        :conversations="(filters.filteredConversations.value as any)"
        :ulove-conversations="(uloveConversations as any)"
        :friends="(filters.filteredFriends.value as any)"
        :pending-in="(filters.filteredPendingIn.value as any)"
        :blocked="(filters.filteredBlocked.value as any)"
        :filter="filters.chatFilter.value"
        @update:filter="(v: string) => filters.chatFilter.value = v"
        :selected-id="selectedId"
        :is-saved-open="isSavedOpen"
        :conversations-sentinel="convSentinel"
        :conversations-has-more="convHasMore"
        :conversations-loading-more="convLoadingMore"
        :friends-sentinel="friendsSentinel"
        :friends-has-more="friendsHasMore"
        :friends-loading-more="friendsLoadingMore"
        :privacy="privacy"
        :show-privacy="showPrivacy"
        @update:show-privacy="(v: boolean) => showPrivacy = v"
        :is-online="isOnline"
        :format-time="formatTime"
        @refresh="refresh"
        @people="filters.showPeopleSearch.value = true"
        @saved="goNotes"
        @open="openConversationAsChat"
        @start-chat="startChatAsChat"
        @toggle-chat-pin="toggleChatPin"
        @delete-chat="askDeleteChat"
        @clear-all-chats="askClearAllChats"
        @block="askBlock"
        @unblock="askUnblock"
        @remove-friend="askRemoveFriend"
        @accept="(id: number) => friendsApi.accept(id)"
        @decline="(id: number) => friendsApi.decline(id)"
        @save-privacy="savePrivacy"
      />
      <SavedNotesChat v-if="isSavedOpen" show-back @back="closeNotes" />
      <ChatWindow
        v-else
        :selected-id="selectedId"
        :active-conv="activeConv"
        :messages="messages"
        :loading="loading"
        :sending="sending"
        :refreshing="refreshing"
        :typing="[...typingUsers].some((id: any) => id === activeConv?.other?.id)"
        :online="isOnline(activeConv?.other?.id, (activeConv?.other as any)?.last_seen_at)"
        :dating-entry="!isBusiness && datingTheme.isDatingEntry.value"
        :dating-badge="isBusiness ? null : datingTheme.badge.value"
        :input="input"
        @update:input="(v: string) => input = v"
        :emoji-open="emojiOpen"
        :emoji-groups="EMOJI_GROUPS"
        :editing-id="editingId"
        :editing-body="editingBody"
        @update:editing-body="(v: string) => editingBody = v"
        :show-menu="showChatMenu"
        :keyboard-style="{}"
        :is-own-message="isOwnMessage"
        :message-status="messageStatus"
        :format-time="formatTime"
        :reply-to="reply.replyTo.value"
        :attachment-name="attachment.file.value?.name ?? null"
        :attachment-size="attachment.file.value?.size ?? null"
        :preview-url="attachment.previewUrl.value"
        :attach-error="attachment.error.value"
        :attaching="attachment.processing.value"
        :locating="locating"
        @send="handleSend"
        @share-location="handleShareLocation"
        @pick-file="handlePickFile"
        @paste-image="handlePasteImage"
        @remove-file="attachment.clear()"
        @typing="notifyTyping"
        @stop-typing="stopTyping"
        @refresh="refresh"
        @back="backToChatList"
        @close="backToChatList"

        @toggle-menu="showChatMenu = !showChatMenu"
        @menu-close="showChatMenu = false"
        @toggle-chat-pin="toggleChatPin"
        @wallpaper="wallpaperOpen = true"
        @presets="presetsOpen = true"
        @auto-reply="autoReplyOpen = true"
        @delete-chat="() => askDeleteChat()"
        @block="activeConv?.other && askBlock(activeConv.other.id, activeConv.other.name)"
        @report="activeConv?.other && reportDialog.openReport('user', activeConv.other.id, activeConv.other.name ?? '')"
        @toggle-emoji="toggleEmoji"
        @emoji-close="emoji.close()"
        @pick-emoji="onPickEmoji"
        @pick-emoji-edit="onPickEmojiForEdit"
        @start-edit="handleStartEdit"
        @save-edit="saveEdit"
        @cancel-edit="cancelEdit"
        @delete-message="askDeleteMessage"
        :selection-active="selection.active.value"
        :selection-count="selection.count.value"
        :can-delete-selection="canDeleteSelection"
        :is-message-selected="(id: number) => selection.isSelected(id)"
        @toggle-select="toggleSelectMessage"
        @selection-forward="openForward"
        @selection-delete="askDeleteSelection"
        @selection-cancel="cancelSelection"
        :pinned="pins.pinned.value"
        :pin-limit-label="pins.limitLabel()"
        :flash-id="pins.flashId.value"
        @toggle-pin="togglePin"
        @unpin="(id: number) => pins.unpin(id)"
        @jump-to-message="jumpToMessage"
        @reply="handleStartReply"
        :voice-recording="voice.isRecording.value"
        :voice-duration="voice.duration.value"
        :voice-level="voice.level.value"
        :voice-error="voice.error.value"
        :voice-preview-url="voice.previewUrl.value"
        :voice-preview-duration="voice.previewDuration.value"
        :has-voice-preview="voice.hasPreview.value"
        @start-voice="handleStartVoice"
        @stop-voice="handleStopVoice"
        @cancel-voice="handleCancelVoice"
        @send-voice="handleSendVoice"
        @discard-voice="voice.discardPreview()"
        @cancel-reply="reply.cancelReply()"
        @invite-district="openDistrictInviteFromChat(activeConv)"
        :history-top-sentinel="setHistoryTop"
        :history-has-more="chat.history.hasMore.value"
        :history-loading="chat.history.loadingOlder.value"
      />
    </div>
  </div>
  <ChatSearchDialog
    :open="filters.showPeopleSearch.value"
    @update:open="(v: boolean) => filters.showPeopleSearch.value = v"
    :query="searchQuery"
    @update:query="(v: string) => searchQuery = v"
    :results="searchResults"
    :searching="searching"
    :creating="creatingChat"
    :is-online="isOnline"
    @chat="(u: any) => { startChatAsChat(u); filters.showPeopleSearch.value = false }"
    @add="addFriendFromSearch"
    @block="askBlock"
  />
  <ChatConfirmDialog :confirm="confirm" @close="closeConfirm" @ok="doConfirm" />
  <MessageForwardDialog
    :open="forwardOpen"
    :conversations="(chat.conversations.value as any[])"
    :current-id="selectedId"
    :count="selection.count.value"
    :sending="forwarding"
    :target-id="forwardingTargetId"
    :sources="(forwardSources as any)"
    @close="forwardOpen = false"
    @pick="(id: number | 'saved') => forwardSelection(id)"
  />
  <ChatWallpaperDialog
    :open="wallpaperOpen"
    :conversation-id="selectedId"
    @update:open="(v: boolean) => wallpaperOpen = v"
  />
  <ChatPresetsDialog
    :open="presetsOpen"
    @update:open="(v: boolean) => presetsOpen = v"
    @select="insertPreset"
    @send="sendPreset"
  />
  <ChatAutoReplyDialog
    :open="autoReplyOpen"
    @update:open="(v: boolean) => autoReplyOpen = v"
    @saved="onAutoReplySaved"
  />
  <DistrictInviteDialog
    :open="districtInvite.open.value"
    @update:open="districtInvite.setOpen"
    :district-name="districtInvite.districtName.value"
    :query="districtInvite.query.value"
    @update:query="districtInvite.search"
    :results="districtInvite.results.value"
    :searching="districtInvite.searching.value"
    :inviting-id="districtInvite.invitingId.value"
    :error="districtInvite.error.value"
    @invite="sendDistrictInviteFromChat"
  />
  <ChatBottomSheet
    :sheet="sheet"
    :is-own-message="isOwnMessage"
    @close="closeSheet"
    @open-chat="openConversationAsChat"
    @start-chat="startChatAsChat"
    @edit="(m: any) => { closeSheet(); handleStartEdit(m) }"
    @delete-message="(id: number) => { closeSheet(); askDeleteMessage(id) }"
    @delete-chat="(id?: number) => askDeleteChat(id)"
    @toggle-chat-pin="(id: number, pinned: boolean) => { closeSheet(); toggleChatPin(id, pinned) }"
    @block="askBlock"
    @report="(id: number, name?: string) => { closeSheet(); reportDialog.openReport('user', id, name ?? '') }"
    @unblock="askUnblock"
    @remove-friend="askRemoveFriend"
    @accept="(id: number) => { closeSheet(); friendsApi.accept(id) }"
    @decline="(id: number) => { friendsApi.decline(id); closeSheet() }"
    @add="(id: number) => { closeSheet(); friendsApi.add(id) }"
  />
  <ReportDialog :dialog="reportDialog" />
</template>
