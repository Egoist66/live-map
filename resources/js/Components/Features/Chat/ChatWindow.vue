<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { computed, toRef } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import ContextMenu from 'primevue/contextmenu'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import OrgBadge from '@/Components/Features/Chat/OrgBadge.vue'
import MessageBubble from '@/Components/Features/Chat/MessageBubble.vue'
import VoiceMessagePlayer from '@/Components/Features/Chat/VoiceMessagePlayer.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useMessageContextMenu } from '@/composables/useMessageContextMenu'
import { useMessageSwipe } from '@/composables/useMessageSwipe'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useChatLayout } from '@/composables/useChatLayout'
import { useChatHeaderLink } from '@/composables/useChatHeaderLink'
import { useChatComposerMenu } from '@/composables/useChatComposerMenu'
import { useChatWallpaper } from '@/composables/useChatWallpaper'
import { useChatPeerPanelTheme, type ChatPeerTone } from '@/composables/useChatPeerPanelTheme'
import { useEnterToSend } from '@/composables/useEnterToSend'
import { formatVoiceTime, VOICE_MAX_SECONDS } from '@/composables/useVoiceRecorder'

const { windowCardClass } = useChatLayout()
const composerMenu = useChatComposerMenu()
const wallpaper = useChatWallpaper()
const { handleEnterToSend } = useEnterToSend()

const props = defineProps<{ selectedId: number | null; activeConv: any; messages: any[]; loading: boolean; sending: boolean; refreshing: boolean; typing: boolean; online: boolean; input: string; emojiOpen: boolean; emojiGroups: any[]; editingId: number | null; editingBody: string; showMenu: boolean; keyboardStyle: any; locating?: boolean; peerPanelAvailable?: boolean; peerPanelOpen?: boolean; peerTone?: ChatPeerTone; isOwnMessage: (m: any) => boolean; messageStatus: (m: any) => string; formatTime: (s: string) => string; pinned?: any[]; pinLimitLabel?: string; flashId?: number | null; datingEntry?: boolean; datingBadge?: string | null; replyTo?: any | null; attachmentName?: string | null; attachmentSize?: number | null; previewUrl?: string | null; attachError?: string | null; attaching?: boolean; voiceRecording?: boolean; voiceDuration?: number; voiceLevel?: number; voiceError?: string | null; voicePreviewUrl?: string | null; voicePreviewDuration?: number; hasVoicePreview?: boolean; historyTopSentinel?: (el: unknown) => void | { value: unknown }; historyHasMore?: boolean; historyLoading?: boolean }>()
const emit = defineEmits<{ (e: 'update:input', v: string): void; (e: 'update:editingBody', v: string): void; (e: 'send'): void; (e: 'share-location'): void; (e: 'presets'): void; (e: 'autoReply'): void; (e: 'typing'): void; (e: 'stopTyping'): void; (e: 'refresh'): void; (e: 'back'): void; (e: 'close'): void; (e: 'toggleMenu'): void; (e: 'menuClose'): void; (e: 'wallpaper'): void; (e: 'togglePeer'): void; (e: 'deleteChat'): void; (e: 'block'): void; (e: 'toggleEmoji'): void; (e: 'emojiClose'): void; (e: 'pickEmoji', v: string): void; (e: 'pickEmojiEdit', v: string): void; (e: 'startEdit', m: any): void; (e: 'saveEdit'): void; (e: 'cancelEdit'): void; (e: 'deleteMessage', id: number): void; (e: 'togglePin', m: any): void; (e: 'unpin', id: number): void; (e: 'jumpToMessage', id: number): void; (e: 'swipesBack'): void; (e: 'reply', m: any): void; (e: 'cancelReply'): void; (e: 'pickFile', f: File | null): void; (e: 'removeFile'): void; (e: 'pasteImage', ev: ClipboardEvent): void; (e: 'startVoice'): void; (e: 'stopVoice'): void; (e: 'cancelVoice'): void; (e: 'sendVoice'): void; (e: 'discardVoice'): void; (e: 'inviteDistrict'): void }>()
const { cm, menuModel, bindMessage } = useMessageContextMenu({ isOwn: (m: any) => props.isOwnMessage(m), onEdit: (m: any) => emit('startEdit', m), onDelete: (id: number) => emit('deleteMessage', id), onPin: (m: any) => emit('togglePin', m), onReply: (m: any) => emit('reply', m) })
const swipe = useMessageSwipe({ onReply: (m: any) => emit('reply', m) })
const { menuPt } = useDropdownMenuStyle()
const headerLink = useChatHeaderLink(toRef(props, 'activeConv'))
const peerTheme = useChatPeerPanelTheme(computed(() => props.peerTone ?? 'ulove'))

function pinPreview(body: string): string {
  const t = (body || '').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 60)}…` : t
}

function replyPreview(message: any): string {
  const kind = String(message?.attachment?.kind ?? message?.type ?? '')
  if (kind === 'voice' || kind === 'audio') {
    const secs = Number(message?.attachment?.duration ?? 0)
    return secs > 0 ? `🎤 Голосовое · ${secs} c` : '🎤 Голосовое'
  }
  const t = String(message?.body ?? '').replace(/\s+/g, ' ').trim()
  return t.length > 80 ? `${t.slice(0, 80)}…` : t
}
</script>
<template>
  <div :class="[selectedId ? 'flex' : 'hidden lg:flex', windowCardClass]">
    <div v-if="!selectedId" class="hidden lg:grid flex-1 place-items-center text-stone-400 text-sm p-8 text-center min-w-0">
      <div><div class="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto text-2xl mb-3">💬</div><div class="font-semibold dark:text-white">Выберите чат</div><div class="text-xs mt-1">Или найдите человека через поиск</div></div>
    </div>
    <template v-else>
      <div :class="datingEntry ? 'pl-1 pr-2 lg:px-4 py-2 border-b border-rose-200 flex items-center gap-2 shrink-0 bg-gradient-to-r from-rose-500 to-orange-400 text-white sticky top-0 z-30 min-w-0 rounded-t-none lg:rounded-t-2xl min-h-[60px]' : 'pl-1 pr-2 lg:px-4 py-2 border-b dark:border-zinc-800 flex items-center gap-2 shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur sticky top-0 z-30 min-w-0 rounded-t-none lg:rounded-t-2xl min-h-[60px]'">
        <button @click="emit('back')" :class="datingEntry ? 'text-white hover:bg-white/20' : 'hover:bg-black/10'" class="lg:hidden w-9 h-9 grid place-items-center rounded-full active:scale-95 shrink-0 text-xl leading-none">‹</button>
        <button v-if="datingEntry" @click="emit('swipesBack')" title="Назад в свайпы" class="!hidden sm:!grid w-9 h-9 place-items-center rounded-full bg-white/20 hover:bg-white/30 active:scale-95 shrink-0"><i class="pi pi-heart-fill text-sm"></i></button>
        <Link :href="headerLink.headerHref.value" class="flex items-center gap-2.5 hover:opacity-80 min-w-0 flex-1 overflow-hidden py-0.5">
          <span class="relative block shrink-0 w-10 h-10"><span v-if="activeConv?.title" class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-700 to-purple-900 text-white grid place-items-center">🏘️</span><Avatar v-else :image="avatarSrcFor(activeConv?.other)" shape="circle" class="!w-10 !h-10 [&_img]:object-cover" :class="datingEntry ? 'ring-2 ring-white/70' : ''" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot v-if="!activeConv?.title" :online="online" /></span>
          <span class="min-w-0 flex-1 block"><span class="block text-[15px] lg:text-sm font-semibold truncate hover:underline leading-snug" :class="datingEntry ? 'text-white' : 'dark:text-white'">{{ activeConv?.title || activeConv?.other?.name }} <OrgBadge :is-organization="activeConv?.other?.is_organization" /></span><span v-if="typing" class="mt-0.5 block text-xs leading-none animate-pulse" :class="datingEntry ? 'text-white/90' : 'text-violet-600'">печатает...</span><span v-else-if="activeConv?.title" class="mt-0.5 block text-xs leading-none text-violet-600">🏘️ Общий чат района</span><span v-else-if="datingBadge" class="mt-0.5 text-[11px] font-bold leading-none flex items-center gap-1" :class="datingEntry ? 'text-white/90' : 'text-rose-500'"><i class="pi pi-heart-fill text-[10px]"></i>{{ datingBadge }}</span><span v-else class="mt-0.5 block text-xs leading-none" :class="datingEntry ? 'text-white/80' : (online ? 'text-emerald-600' : 'text-red-500')">{{ online ? 'в сети' : 'оффлайн' }}</span></span>
        </Link>
        <div class="flex items-center gap-0.5 shrink-0" :class="datingEntry ? 'text-white' : ''">
          <Button v-if="activeConv?.type === 'district' && activeConv?.can_invite" @click="emit('inviteDistrict')" icon="pi pi-user-plus" rounded text severity="secondary" :class="datingEntry ? '!text-white hover:!bg-white/20' : ''" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Пригласить в район" title="Пригласить в район" />
          <!-- Сырая кнопка, а не PrimeVue Button: у Button иконка съезжает из-за внутренних span-отступов; здесь та же коробка w-9 h-9 grid, что у соседних кнопок шапки — иконка строго по центру. -->
          <button v-if="peerPanelAvailable" @click="emit('togglePeer')" type="button" aria-label="Панель собеседника" title="Панель собеседника" :class="['hidden w-9 h-9 xl:grid place-items-center rounded-full active:scale-95 transition shrink-0', peerPanelOpen && !datingEntry ? peerTheme.toggleActive : (datingEntry ? 'text-white hover:bg-white/20' : 'text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800')]"><i class="pi pi-id-card text-[15px] leading-none"></i></button>
          <Button @click="emit('refresh')" :loading="refreshing" icon="pi pi-refresh" rounded text :severity="datingEntry ? undefined : 'secondary'" :class="datingEntry ? '!text-white hover:!bg-white/20' : ''" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Обновить" />
          <div class="relative">
            <button @click="emit('toggleMenu')" :class="datingEntry ? 'hover:bg-white/20' : 'hover:bg-stone-100 dark:hover:bg-zinc-800'" class="w-9 h-9 grid place-items-center rounded-full active:scale-95 text-lg leading-none">⋯</button>
            <div v-if="showMenu" class="absolute right-0 top-10 w-52 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden text-stone-900 dark:text-zinc-100">
              <button v-if="activeConv?.type === 'district' && activeConv?.can_invite" @click="emit('menuClose'); emit('inviteDistrict')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 active:bg-violet-100 transition"><i class="pi pi-user-plus text-xs"></i>Пригласить в район</button>
              <button @click="emit('menuClose'); emit('wallpaper')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-zinc-700/60 active:bg-stone-100 transition"><i class="pi pi-image text-xs text-stone-400"></i>Фон чата</button>
              <button @click="emit('menuClose'); emit('autoReply')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-zinc-700/60 active:bg-stone-100 transition"><i class="pi pi-reply text-xs text-stone-400"></i>Автоответ</button>
              <button @click="emit('menuClose'); emit('deleteChat')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 active:bg-red-100 transition"><i class="pi pi-trash text-xs"></i>Удалить чат</button>
              <button v-if="activeConv?.other" @click="emit('menuClose'); emit('block')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 active:bg-red-100 transition"><i class="pi pi-ban text-xs"></i>Заблокировать</button>
            </div>
          </div>
          <button @click="emit('close')" title="Закрыть чат" :class="datingEntry ? 'bg-white/20 hover:bg-white/30' : 'bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200'" class="w-9 h-9 grid place-items-center rounded-full active:scale-95 transition shrink-0"><i class="pi pi-times text-sm" :class="datingEntry ? 'text-white' : 'text-stone-600 dark:text-zinc-300'"></i></button>
        </div>
      </div>
      <div v-if="showMenu" @click="emit('menuClose')" class="fixed inset-0 z-20"></div>
      <div v-if="(pinned || []).length" class="shrink-0 border-b dark:border-zinc-800 bg-violet-50/80 dark:bg-violet-950/30 px-2 lg:px-4 py-1.5 min-w-0">
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300 px-1 mb-1"><span>📌 Закрепы</span><span class="opacity-70">{{ (pinned || []).length }}/{{ pinLimitLabel || '∞' }}</span></div>
        <div class="flex gap-1.5 overflow-x-auto pb-0.5">
          <div v-for="p in (pinned || [])" :key="p?.id" class="shrink-0 max-w-[240px] flex items-center gap-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-full pl-3 pr-1 py-1 text-xs shadow-sm">
            <button @click="emit('jumpToMessage', p?.id)" class="truncate text-left hover:underline min-w-0 flex-1 dark:text-zinc-100">{{ pinPreview(p?.body ?? '') }}</button>
            <button @click="emit('unpin', p?.id)" class="w-6 h-6 shrink-0 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-400" aria-label="Открепить"><i class="pi pi-times text-[10px]"></i></button>
          </div>
        </div>
      </div>
      <div class="relative flex-1 min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-stone-50/50 dark:bg-zinc-950/30">
        <div v-if="wallpaper.hasWallpaper.value" aria-hidden="true" class="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat" :style="(wallpaper.wallpaperLayerStyle.value as any)" />
        <div v-if="wallpaper.hasWallpaper.value" aria-hidden="true" class="pointer-events-none absolute inset-0 bg-white/60 dark:bg-black/60" />
        <div id="chat-messages" class="relative z-10 h-full overflow-auto overscroll-contain [scrollbar-width:thin] max-lg:[-ms-overflow-style:none] max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden p-3 lg:p-4 min-w-0 w-full max-w-full bg-transparent">
        <div class="min-h-full">
        <div :ref="historyTopSentinel as any" aria-hidden="true" class="h-px w-full" />
        <div v-if="loading" class="flex justify-center py-6"><span class="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span></div>
        <div v-else-if="historyLoading" class="flex justify-center py-3"><span class="w-5 h-5 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span></div>
        <div v-else-if="historyHasMore && (messages || []).length" class="py-2 text-center text-[11px] text-stone-400">Потяни вверх — подгрузим старше</div>
        <div v-else-if="!(messages || []).length" class="h-full grid place-items-center text-stone-400 text-sm text-center"><div><div class="text-3xl mb-2">✉️</div><div>Пока пусто — напишите первым</div></div></div>
        <template v-for="m in (messages || [])" :key="m?.id">
          <div v-if="m" :id="`msg-${m.id}`" class="pb-2.5">
            <div v-if="editingId === m.id" class="flex justify-end min-w-0">
                  <div class="bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl shadow-lg w-full max-w-[92vw] sm:max-w-[86vw] min-w-0 p-2">
                    <Textarea :model-value="editingBody" @update:model-value="(v:any)=>emit('update:editingBody', v)" @keydown="(e:any)=>handleEnterToSend(e, () => emit('saveEdit'))" @keydown.escape="emit('cancelEdit')" rows="2" autoResize maxlength="2000" class="w-full !rounded-xl text-sm" placeholder="Сообщение..." />
                    <div class="flex gap-2 mt-2 items-center min-w-0">
                      <div class="flex gap-0.5 min-w-0 flex-1 overflow-x-auto"><button v-for="e in emojiGroups[0].emojis.slice(0, 6)" :key="e" @click="emit('pickEmojiEdit', e)" class="w-7 h-7 shrink-0 grid place-items-center hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-lg text-sm">{{ e }}</button></div>
                      <div class="flex gap-1.5 shrink-0 items-center">
                        <Button @click="emit('cancelEdit')" icon="pi pi-times" severity="secondary" outlined rounded class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Отменить" title="Отмена" />
                        <Button @click="emit('saveEdit')" :disabled="!String(editingBody || '').trim()" icon="pi pi-check" rounded class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Сохранить" title="Сохранить" />
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else v-on="swipe.merge(swipe.bindSwipe(m), bindMessage(m))" :style="swipe.swipeStyle(m)" :class="['relative rounded-2xl transition-shadow duration-500 scroll-mt-2 touch-pan-y', flashId === m.id ? 'ring-2 ring-violet-500 shadow-lg' : '', (swipe.offsets.value[m.id] ?? 0) ? '' : 'transition-transform duration-200']">
                  <div v-if="swipe.hintId.value === m.id" class="absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 grid place-items-center rounded-full bg-violet-600 text-white shadow-lg pointer-events-none" :class="isOwnMessage(m) ? 'left-1' : 'right-1'"><i class="pi pi-reply text-sm"></i></div>
                  <MessageBubble :message="m" :own="isOwnMessage(m)" :status="messageStatus(m)" :time="formatTime(m.created_at)" @edit="(mm:any)=>emit('startEdit', mm)" @delete="(id:number)=>emit('deleteMessage', id)" @pin="(mm:any)=>emit('togglePin', mm)" @reply="(mm:any)=>emit('reply', mm)" @jump="(id:number)=>emit('jumpToMessage', id)" />
                </div>
          </div>
          </template>
        </div>
        </div>
      </div>
      <ContextMenu ref="cm" :model="menuModel" :pt="menuPt" />
      <div class="relative p-2 lg:p-3 border-t dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 flex-none pb-[calc(0.5rem+var(--sab))] lg:pb-3 w-full max-w-full min-w-0 rounded-b-none lg:rounded-b-2xl">
        <div v-if="replyTo" class="flex items-center gap-2.5 bg-violet-50 dark:bg-violet-500/10 border-l-[3px] border-violet-500 rounded-r-xl rounded-l-sm px-3 py-2 mb-2 min-w-0">
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-bold text-violet-600 dark:text-violet-300 truncate">↩ {{ isOwnMessage(replyTo) ? 'Вы' : (replyTo.sender?.name || 'Сообщение') }}</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ replyPreview(replyTo) }}</div>
          </div>
          <button @click="emit('cancelReply')" aria-label="Отменить ответ" class="w-7 h-7 shrink-0 grid place-items-center rounded-full hover:bg-violet-100 dark:hover:bg-white/10 text-stone-500 active:scale-95 transition"><i class="pi pi-times text-xs"></i></button>
        </div>
        <div v-if="emojiOpen" class="absolute bottom-full left-2 right-2 mb-2 bg-white dark:bg-zinc-800 border rounded-[20px] shadow-xl p-3 z-50 max-h-[42dvh] overflow-auto">
          <div v-for="g in emojiGroups" :key="g.label" class="mb-2 last:mb-0">
            <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 mb-1.5">{{ g.label }}</div>
            <div class="flex flex-wrap gap-1"><button v-for="e in g.emojis" :key="e" @click="emit('pickEmoji', e)" class="w-10 h-10 grid place-items-center hover:bg-stone-100 rounded-xl text-[20px]">{{ e }}</button></div>
          </div>
        </div>
        <div v-if="emojiOpen" @click="emit('emojiClose')" class="fixed inset-0 z-40"></div>
        <div v-if="attachmentName || previewUrl" class="flex items-center gap-2 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800 rounded-2xl px-2.5 py-2 mb-2 min-w-0">
          <img v-if="previewUrl" :src="previewUrl" alt="" class="w-10 h-10 rounded-xl object-cover shrink-0" />
          <span v-else class="w-10 h-10 rounded-xl bg-violet-600/10 grid place-items-center shrink-0"><i class="pi pi-file text-lg text-violet-600 dark:text-violet-300"></i></span>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold truncate dark:text-zinc-100">{{ attachmentName }}</div>
            <div v-if="attachmentSize" class="text-[11px] text-stone-500 dark:text-zinc-400">{{ (attachmentSize / 1024).toFixed(0) }} КБ · макс 10 МБ</div>
          </div>
          <span v-if="attaching" class="w-5 h-5 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin shrink-0"></span>
          <button @click="emit('removeFile')" aria-label="Убрать файл" class="w-7 h-7 shrink-0 grid place-items-center rounded-full hover:bg-violet-100 dark:hover:bg-white/10 text-stone-500 active:scale-95 transition"><i class="pi pi-times text-xs"></i></button>
        </div>
        <div v-if="attachError" class="text-[11px] text-red-600 dark:text-red-400 px-1 mb-1.5">{{ attachError }}</div>
        <div v-if="voiceError" class="text-[11px] text-red-600 dark:text-red-400 px-1 mb-1.5">{{ voiceError }}</div>
        <div v-if="voiceRecording" class="relative flex gap-2 items-center min-w-0 w-full max-w-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 rounded-2xl px-2.5 py-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold tabular-nums dark:text-white">{{ formatVoiceTime(voiceDuration ?? 0) }} / {{ formatVoiceTime(VOICE_MAX_SECONDS) }}</div>
            <div class="h-1 mt-1 rounded-full bg-red-100 dark:bg-red-500/20 overflow-hidden"><div class="h-full rounded-full bg-red-500 transition-[width] duration-150" :style="{ width: `${Math.round((voiceLevel ?? 0) * 100)}%` }"></div></div>
          </div>
          <Button @click="emit('cancelVoice')" icon="pi pi-trash" severity="danger" text rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Отменить запись" />
          <Button @click="emit('stopVoice')" icon="pi pi-stop" severity="danger" rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Остановить" />
        </div>
        <div v-else-if="hasVoicePreview" class="relative flex gap-2 items-center min-w-0 w-full max-w-full bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800 rounded-2xl px-2.5 py-1.5">
          <div class="flex-1 min-w-0"><VoiceMessagePlayer :src="voicePreviewUrl ?? null" :duration="voicePreviewDuration" /></div>
          <Button @click="emit('discardVoice')" icon="pi pi-trash" severity="danger" text rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Удалить запись" />
          <Button @click="emit('sendVoice')" :loading="sending" icon="pi pi-send" rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Отправить голосовое" />
        </div>
        <div v-else data-chat-input class="relative flex gap-2 items-end min-w-0 w-full max-w-full">
          <input type="file" data-chat-file class="hidden" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" @change="(e:any)=>{ const f = e.target.files?.[0] ?? null; emit('pickFile', f); e.target.value = '' }" />
          <div class="relative shrink-0">
            <Button @click="composerMenu.toggle()" icon="pi pi-ellipsis-h" severity="secondary" outlined rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Ещё" />
            <div v-if="composerMenu.open.value" class="absolute bottom-full left-0 mb-2 w-52 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden">
              <button @click="(e:any)=>{ composerMenu.close(); const btn = e?.currentTarget as HTMLElement | null; const root = btn?.closest?.('[data-chat-input]') as HTMLElement | null; const inp = root?.querySelector?.('[data-chat-file]') as HTMLInputElement | null; inp?.click() }" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-zinc-700/60 active:bg-stone-100 transition"><i class="pi pi-paperclip text-xs text-stone-400"></i>Документ</button>
              <button @click="composerMenu.close(); emit('toggleEmoji')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-zinc-700/60 active:bg-stone-100 transition"><span class="text-base leading-none">😊</span>Эмодзи</button>
              <button @click="composerMenu.close(); emit('share-location')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-zinc-700/60 active:bg-stone-100 transition"><i class="pi pi-map-marker text-xs text-stone-400"></i>Геопозиция</button>
              <button @click="composerMenu.close(); emit('presets')" class="w-full flex items-center gap-2.5 text-left px-4 py-3 text-sm font-medium dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-zinc-700/60 active:bg-stone-100 transition"><i class="pi pi-comments text-xs text-stone-400"></i>Пресеты сообщений</button>
            </div>
          </div>
          <Textarea :model-value="input" @update:model-value="(v:any)=>emit('update:input', v)" @input="emit('typing')" @blur="emit('stopTyping')" @keydown="(e:any)=>handleEnterToSend(e, () => emit('send'))" @keydown.escape="emit('emojiClose')" @paste="(e:any)=>emit('pasteImage', e as ClipboardEvent)" placeholder="Сообщение..." rows="1" autoResize maxlength="2000" fluid class="!rounded-2xl flex-1 min-w-0 max-h-32" enterkeyhint="enter" />
          <Button v-if="input.trim() || attachmentName" @click="emit('send')" :loading="sending" :disabled="!input.trim() && !attachmentName" icon="pi pi-send" rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Отправить" />
          <Button v-else @click="emit('startVoice')" icon="pi pi-microphone" severity="secondary" outlined rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Голосовое сообщение" />
        </div>
        <div v-if="composerMenu.open.value" @click="composerMenu.close()" class="fixed inset-0 z-40"></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
:global(.danger-item .p-menu-item-label),
:global(.danger-item .p-menu-item-icon) {
  color: #dc2626;
}
</style>
