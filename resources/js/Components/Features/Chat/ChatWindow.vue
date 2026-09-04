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

const props = defineProps<{ selectedId: number | null; activeConv: any; messages: any[]; loading: boolean; sending: boolean; refreshing: boolean; typing: boolean; online: boolean; input: string; emojiOpen: boolean; emojiGroups: any[]; editingId: number | null; editingBody: string; showMenu: boolean; keyboardStyle: any; isOwnMessage: (m: any) => boolean; messageStatus: (m: any) => string; formatTime: (s: string) => string }>()
const emit = defineEmits<{ (e: 'update:input', v: string): void; (e: 'update:editingBody', v: string): void; (e: 'send'): void; (e: 'typing'): void; (e: 'stopTyping'): void; (e: 'refresh'): void; (e: 'back'): void; (e: 'close'): void; (e: 'toggleMenu'): void; (e: 'menuClose'): void; (e: 'deleteChat'): void; (e: 'block'): void; (e: 'toggleEmoji'): void; (e: 'emojiClose'): void; (e: 'pickEmoji', v: string): void; (e: 'pickEmojiEdit', v: string): void; (e: 'startEdit', m: any): void; (e: 'saveEdit'): void; (e: 'cancelEdit'): void; (e: 'deleteMessage', id: number): void }>()
const { cm, menuModel, bindMessage } = useMessageContextMenu({ isOwn: (m: any) => props.isOwnMessage(m), onEdit: (m: any) => emit('startEdit', m), onDelete: (id: number) => emit('deleteMessage', id) })
</script>
<template>
  <div :class="selectedId ? 'flex' : 'hidden lg:flex'" class="flex-1 min-h-0 bg-white dark:bg-zinc-900 lg:rounded-2xl lg:border border-stone-200 dark:border-zinc-800 flex-col overflow-hidden min-w-0 w-full max-w-full">
    <div v-if="!selectedId" class="hidden lg:grid flex-1 place-items-center text-stone-400 text-sm p-8 text-center min-w-0">
      <div><div class="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto text-2xl mb-3">💬</div><div class="font-semibold dark:text-white">Выберите чат</div><div class="text-xs mt-1">Или найдите человека через поиск</div></div>
    </div>
    <template v-else>
      <div class="px-2 lg:px-4 py-2 lg:py-3 border-b dark:border-zinc-800 flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur sticky top-0 z-10 min-w-0">
        <button @click="emit('back')" class="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-95 shrink-0 -ml-1">‹</button>
        <Link :href="activeConv?.other ? `/users/${activeConv.other.id}` : '#'" class="flex items-center gap-2.5 hover:opacity-80 min-w-0 flex-1">
          <span class="relative shrink-0"><Avatar :image="avatarSrcFor(activeConv?.other)" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="online" /></span>
          <div class="min-w-0"><div class="text-[15px] lg:text-sm font-semibold dark:text-white truncate hover:underline">{{ activeConv?.other?.name }}</div><div v-if="typing" class="text-xs text-violet-600 leading-none animate-pulse">печатает...</div><div v-else class="text-xs leading-none" :class="online ? 'text-emerald-600' : 'text-red-500'">{{ online ? 'в сети' : 'офлайн' }}</div></div>
        </Link>
        <div class="flex items-center gap-0.5 shrink-0">
          <Button @click="emit('refresh')" :loading="refreshing" icon="pi pi-refresh" rounded text severity="secondary" class="!w-9 !h-9 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Обновить" />
          <div class="relative">
            <button @click="emit('toggleMenu')" class="w-9 h-9 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-95 text-lg leading-none">⋯</button>
            <div v-if="showMenu" class="absolute right-0 top-10 w-52 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-2xl shadow-xl py-1.5 z-20">
              <button @click="emit('menuClose'); emit('deleteChat')" class="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600">Удалить чат</button>
              <button v-if="activeConv?.other" @click="emit('menuClose'); emit('block')" class="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600">Заблокировать</button>
            </div>
          </div>
          <button @click="emit('close')" title="Закрыть чат" class="w-9 h-9 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 active:scale-95 transition shrink-0"><i class="pi pi-times text-sm text-stone-600 dark:text-zinc-300"></i></button>
        </div>
      </div>
      <div v-if="showMenu" @click="emit('menuClose')" class="fixed inset-0 z-5 lg:hidden"></div>
      <div id="chat-messages" class="flex-1 overflow-auto overscroll-contain p-3 lg:p-4 space-y-2.5 bg-stone-50/50 dark:bg-zinc-950/30 min-w-0 w-full max-w-full">
        <div v-if="loading" class="flex justify-center py-6"><span class="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span></div>
        <template v-for="m in messages" :key="m.id">
          <div v-if="editingId === m.id" class="flex justify-end min-w-0">
            <div class="bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-2xl p-2.5 shadow-lg w-full max-w-[92vw] sm:max-w-[86vw] min-w-0">
              <input :value="editingBody" @input="emit('update:editingBody', ($event.target as HTMLInputElement).value)" @keydown.enter.prevent="emit('saveEdit')" @keydown.escape="emit('cancelEdit')" class="w-full px-3.5 py-3 rounded-xl border dark:bg-zinc-900 text-[15px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Сообщение..." />
              <div class="flex gap-1.5 mt-2.5 justify-between items-center flex-wrap">
                <div class="flex gap-1"><button v-for="e in emojiGroups[0].emojis.slice(0, 6)" :key="e" @click="emit('pickEmojiEdit', e)" class="w-8 h-8 grid place-items-center hover:bg-stone-100 rounded-xl text-[16px]">{{ e }}</button></div>
                <div class="flex gap-2 ml-auto">
                  <button @click="emit('cancelEdit')" class="px-4 py-2 rounded-full border bg-white dark:bg-zinc-900 text-sm font-medium">Отмена</button>
                  <button @click="emit('saveEdit')" :disabled="!editingBody.trim()" class="px-4 py-2 rounded-full bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">Сохранить</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else v-on="bindMessage(m)">
            <MessageBubble :message="m" :own="isOwnMessage(m)" :status="messageStatus(m)" :time="formatTime(m.created_at)" @edit="(mm:any)=>emit('startEdit', mm)" @delete="(id:number)=>emit('deleteMessage', id)" />
          </div>
        </template>
      </div>
      <ContextMenu ref="cm" :model="menuModel" />
      <div class="relative p-2 lg:p-3 border-t dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 flex-none pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:pb-3 w-full max-w-full min-w-0">
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
