<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ContextMenu from 'primevue/contextmenu'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import MessageBubble from '@/Components/Features/Chat/MessageBubble.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useMessageContextMenu } from '@/composables/useMessageContextMenu'
import { useChatLayout } from '@/composables/useChatLayout'

const { windowCardClass } = useChatLayout()

const props = defineProps<{ selectedId: number | null; activeConv: any; messages: any[]; loading: boolean; sending: boolean; refreshing: boolean; typing: boolean; online: boolean; input: string; emojiOpen: boolean; emojiGroups: any[]; editingId: number | null; editingBody: string; showMenu: boolean; keyboardStyle: any; isOwnMessage: (m: any) => boolean; messageStatus: (m: any) => string; formatTime: (s: string) => string; pinned?: any[]; pinLimitLabel?: string; flashId?: number | null; datingEntry?: boolean; datingBadge?: string | null }>()
const emit = defineEmits<{ (e: 'update:input', v: string): void; (e: 'update:editingBody', v: string): void; (e: 'send'): void; (e: 'typing'): void; (e: 'stopTyping'): void; (e: 'refresh'): void; (e: 'back'): void; (e: 'close'): void; (e: 'toggleMenu'): void; (e: 'menuClose'): void; (e: 'deleteChat'): void; (e: 'block'): void; (e: 'toggleEmoji'): void; (e: 'emojiClose'): void; (e: 'pickEmoji', v: string): void; (e: 'pickEmojiEdit', v: string): void; (e: 'startEdit', m: any): void; (e: 'saveEdit'): void; (e: 'cancelEdit'): void; (e: 'deleteMessage', id: number): void; (e: 'togglePin', m: any): void; (e: 'unpin', id: number): void; (e: 'jumpToMessage', id: number): void; (e: 'swipesBack'): void }>()
const { cm, menuModel, bindMessage } = useMessageContextMenu({ isOwn: (m: any) => props.isOwnMessage(m), onEdit: (m: any) => emit('startEdit', m), onDelete: (id: number) => emit('deleteMessage', id), onPin: (m: any) => emit('togglePin', m) })

function pinPreview(body: string): string {
  const t = (body || '').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 60)}…` : t
}
</script>
<template>
  <div :class="[selectedId ? 'flex' : 'hidden lg:flex', windowCardClass]">
    <div v-if="!selectedId" class="hidden lg:grid flex-1 place-items-center text-stone-400 text-sm p-8 text-center min-w-0">
      <div><div class="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto text-2xl mb-3">💬</div><div class="font-semibold dark:text-white">Выберите чат</div><div class="text-xs mt-1">Или найдите человека через поиск</div></div>
    </div>
    <template v-else>
      <div :class="datingEntry ? 'px-2 lg:px-4 py-2 lg:py-3 border-b border-rose-200 flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0 bg-gradient-to-r from-rose-500 to-orange-400 text-white sticky top-0 z-10 min-w-0 rounded-t-none lg:rounded-t-2xl' : 'px-2 lg:px-4 py-2 lg:py-3 border-b dark:border-zinc-800 flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur sticky top-0 z-10 min-w-0 rounded-t-none lg:rounded-t-2xl'">
        <button @click="emit('back')" class="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-black/10 active:scale-95 shrink-0">‹</button>
        <button v-if="datingEntry" @click="emit('swipesBack')" title="Назад в свайпы" class="hidden sm:grid w-9 h-9 place-items-center rounded-full bg-white/20 hover:bg-white/30 active:scale-95 shrink-0"><i class="pi pi-heart-fill text-sm"></i></button>
        <Link :href="activeConv?.other ? `/users/${activeConv.other.id}` : '#'" class="flex items-center gap-2.5 hover:opacity-80 min-w-0 flex-1 overflow-hidden">
          <span class="relative shrink-0"><Avatar :image="avatarSrcFor(activeConv?.other)" shape="circle" class="[&_img]:object-cover" :class="datingEntry ? 'ring-2 ring-white/70' : ''" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="online" /></span>
          <div class="min-w-0"><div class="text-[15px] lg:text-sm font-semibold truncate hover:underline" :class="datingEntry ? 'text-white' : 'dark:text-white'">{{ activeConv?.other?.name }}</div><div v-if="datingBadge" class="text-[11px] font-bold leading-tight flex items-center gap-1" :class="datingEntry ? 'text-white/90' : 'text-rose-500'"><i class="pi pi-heart-fill text-[10px]"></i>{{ datingBadge }}</div><div v-else-if="typing" class="text-xs text-violet-600 leading-none animate-pulse">печатает...</div><div v-else class="text-xs leading-none" :class="datingEntry ? 'text-white/80' : (online ? 'text-emerald-600' : 'text-red-500')">{{ online ? 'в сети' : 'оффлайн' }}</div></div>
        </Link>
        <div class="flex items-center gap-0.5 shrink-0">
          <Button @click="emit('refresh')" :loading="refreshing" icon="pi pi-refresh" rounded text severity="secondary" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Обновить" />
          <div class="relative">
            <button @click="emit('toggleMenu')" class="w-9 h-9 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-95 text-lg leading-none">⋯</button>
            <div v-if="showMenu" class="absolute right-0 top-10 w-52 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-2xl shadow-xl py-1.5 z-30">
              <button @click="emit('menuClose'); emit('deleteChat')" class="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600">Удалить чат</button>
              <button v-if="activeConv?.other" @click="emit('menuClose'); emit('block')" class="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600">Заблокировать</button>
            </div>
          </div>
          <button @click="emit('close')" title="Закрыть чат" class="w-9 h-9 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 active:scale-95 transition shrink-0"><i class="pi pi-times text-sm text-stone-600 dark:text-zinc-300"></i></button>
        </div>
      </div>
      <div v-if="showMenu" @click="emit('menuClose')" class="fixed inset-0 z-5 lg:hidden"></div>
      <div v-if="(pinned || []).length" class="shrink-0 border-b dark:border-zinc-800 bg-violet-50/80 dark:bg-violet-950/30 px-2 lg:px-4 py-1.5 min-w-0">
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-violet-700 dark:text-violet-300 px-1 mb-1"><span>📌 Закрепы</span><span class="opacity-70">{{ (pinned || []).length }}/{{ pinLimitLabel || '∞' }}</span></div>
        <div class="flex gap-1.5 overflow-x-auto pb-0.5">
          <div v-for="p in (pinned || [])" :key="p.id" class="shrink-0 max-w-[240px] flex items-center gap-1 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-full pl-3 pr-1 py-1 text-xs shadow-sm">
            <button @click="emit('jumpToMessage', p.id)" class="truncate text-left hover:underline min-w-0 flex-1 dark:text-zinc-100">{{ pinPreview(p.body) }}</button>
            <button @click="emit('unpin', p.id)" class="w-6 h-6 shrink-0 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-400" aria-label="Открепить"><i class="pi pi-times text-[10px]"></i></button>
          </div>
        </div>
      </div>
      <div id="chat-messages" class="flex-1 overflow-auto overscroll-contain [scrollbar-width:thin] max-lg:[-ms-overflow-style:none] max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden p-3 lg:p-4 space-y-2.5 bg-stone-50/50 dark:bg-zinc-950/30 min-w-0 w-full max-w-full">
        <div v-if="loading" class="flex justify-center py-6"><span class="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span></div>
        <template v-for="m in messages" :key="m.id">
          <div v-if="editingId === m.id" class="flex justify-end min-w-0">
            <div class="bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl shadow-lg w-full max-w-[92vw] sm:max-w-[86vw] min-w-0 p-2">
              <input :value="editingBody" @input="emit('update:editingBody', ($event.target as HTMLInputElement).value)" @keydown.enter.prevent="emit('saveEdit')" @keydown.escape="emit('cancelEdit')" class="w-full px-3 py-2 rounded-lg border dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Сообщение..." />
              <div class="flex gap-1 mt-2 justify-between items-center">
                <div class="flex gap-0.5"><button v-for="e in emojiGroups[0].emojis.slice(0, 6)" :key="e" @click="emit('pickEmojiEdit', e)" class="w-7 h-7 grid place-items-center hover:bg-stone-100 rounded-lg text-sm">{{ e }}</button></div>
                <div class="flex gap-1.5 ml-auto shrink-0">
                  <button @click="emit('cancelEdit')" class="px-3 py-1.5 rounded-full border bg-white dark:bg-zinc-900 text-xs font-medium">Отмена</button>
                  <button @click="emit('saveEdit')" :disabled="!editingBody.trim()" class="px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">Сохранить</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else v-on="bindMessage(m)" :id="`msg-${m.id}`" :class="['rounded-2xl transition-shadow duration-500 scroll-mt-2', flashId === m.id ? 'ring-2 ring-violet-500 shadow-lg' : '']">
            <MessageBubble :message="m" :own="isOwnMessage(m)" :status="messageStatus(m)" :time="formatTime(m.created_at)" @edit="(mm:any)=>emit('startEdit', mm)" @delete="(id:number)=>emit('deleteMessage', id)" @pin="(mm:any)=>emit('togglePin', mm)" />
          </div>
        </template>
      </div>
      <ContextMenu ref="cm" :model="menuModel" />
      <div class="relative p-2 lg:p-3 border-t dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 flex-none pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:pb-3 w-full max-w-full min-w-0 rounded-b-none lg:rounded-b-2xl">
        <div v-if="emojiOpen" class="absolute bottom-full left-2 right-2 mb-2 bg-white dark:bg-zinc-800 border rounded-[20px] shadow-xl p-3 z-20 max-h-[42dvh] overflow-auto">
          <div v-for="g in emojiGroups" :key="g.label" class="mb-2 last:mb-0">
            <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 mb-1.5">{{ g.label }}</div>
            <div class="flex flex-wrap gap-1"><button v-for="e in g.emojis" :key="e" @click="emit('pickEmoji', e)" class="w-10 h-10 grid place-items-center hover:bg-stone-100 rounded-xl text-[20px]">{{ e }}</button></div>
          </div>
        </div>
        <div v-if="emojiOpen" @click="emit('emojiClose')" class="fixed inset-0 z-10"></div>
        <div class="relative flex gap-2 items-end min-w-0 w-full max-w-full z-10">
          <Button @click="emit('toggleEmoji')" :severity="emojiOpen ? 'contrast' : 'secondary'" :outlined="!emojiOpen" rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center text-[20px]" label="😊" />
          <InputText :model-value="input" @update:model-value="(v:any)=>emit('update:input', v)" @input="emit('typing')" @blur="emit('stopTyping')" @keydown.enter.prevent="emit('send')" @keydown.escape="emit('emojiClose')" placeholder="Сообщение..." fluid class="!rounded-full flex-1 min-w-0" enterkeyhint="send" />
          <Button @click="emit('send')" :loading="sending" :disabled="!input.trim()" icon="pi pi-send" rounded class="!w-11 !h-11 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-label]:hidden [&_.p-button-icon]:!m-0" aria-label="Отправить" />
        </div>
      </div>
    </template>
  </div>
</template>
