<script setup lang="ts">
import { onMounted } from 'vue'
import { Link } from '@inertiajs/vue3'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import OnlineDot from '@/Components/OnlineDot.vue'
import { usePresenceState } from '@/composables/usePresence'
import { useChatPage } from '@/composables/useChatPage'

const props = defineProps<{ conversationId?: number }>()
const {
  chat, friendsApi, blocksApi, emoji,
  input, inputRef, editInputRef, tab, showChatMenu, sheet, showPrivacy, privacy, creatingChat, confirm, confirmVisible, isOwnMessage, bindSheet,
  handleSend, formatTime, onPickEmoji, onPickEmojiForEdit, handleStartEdit, startChatWith, savePrivacy, doConfirm, closeSheet, backToList, init,
  askBlock, askDeleteChat, askRemoveFriend, askUnblock,
} = useChatPage(props.conversationId)

const { conversations, activeConv, messages, loading, sending, refreshing, typingUsers, searchQuery, searchResults, searching, selectedId, unreadTotal, editingId, editingBody, refresh, openConversation, saveEdit, cancelEdit, notifyTyping, stopTyping } = chat
const { friends, pendingIn } = friendsApi
const { blocked } = blocksApi
const { open: emojiOpen, toggle: toggleEmoji, EMOJI_GROUPS } = emoji
const { isOnline } = usePresenceState()

onMounted(init)
</script>

<template>
<AuthenticatedLayout>
<Toast />
<div class="mx-auto max-w-[1280px] lg:px-6 lg:py-6">
  <div class="flex flex-col lg:flex-row lg:gap-4 h-[calc(100dvh-64px)] lg:h-[calc(100dvh-88px)] bg-stone-100 dark:bg-zinc-950 lg:bg-transparent overflow-hidden lg:overflow-visible">
    <div :class="selectedId ? 'hidden lg:flex' : 'flex'" class="w-full lg:w-[360px] shrink-0 bg-white dark:bg-zinc-900 lg:rounded-2xl border-b lg:border border-stone-200 dark:border-zinc-800 flex-col overflow-hidden">
      <div class="p-3 sm:p-3 border-b dark:border-zinc-800 shrink-0">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="text-[15px] font-bold dark:text-white tracking-tight">Мессенджер</h2>
          <span v-if="unreadTotal" class="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{{ unreadTotal }}</span>
          <button @click="refresh" :disabled="refreshing" title="Обновить" class="ml-auto w-8 h-8 grid place-items-center rounded-full bg-stone-900 dark:bg-white text-white dark:text-zinc-900 active:scale-95 disabled:opacity-50 transition lg:hidden">
            <svg :class="['w-4 h-4', refreshing ? 'animate-spin' : '']" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button @click="refresh" :disabled="refreshing" title="Обновить чаты и сообщения" class="hidden lg:flex ml-auto group items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-semibold shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 transition-all">
            <svg :class="['w-3.5 h-3.5 transition-transform duration-500', refreshing ? 'animate-spin' : 'group-hover:rotate-180']" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {{ refreshing ? '...' : 'Обновить' }}
          </button>
        </div>
        <div class="flex gap-1 bg-stone-100 dark:bg-zinc-800 p-1 rounded-full overflow-x-auto scrollbar-none snap-x">
          <button @click="tab='chats'" :class="tab==='chats'?'bg-white dark:bg-zinc-700 shadow text-ink-900 dark:text-white':'text-stone-500 dark:text-zinc-400'" class="flex-1 min-w-[66px] snap-start py-2 lg:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition">Чаты <span v-if="unreadTotal" class="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px] align-middle">{{ unreadTotal }}</span></button>
          <button @click="tab='friends'" :class="tab==='friends'?'bg-white dark:bg-zinc-700 shadow text-ink-900 dark:text-white':'text-stone-500 dark:text-zinc-400'" class="flex-1 min-w-[66px] snap-start py-2 lg:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition">Друзья</button>
          <button @click="tab='requests'" :class="tab==='requests'?'bg-white dark:bg-zinc-700 shadow text-ink-900 dark:text-white':'text-stone-500 dark:text-zinc-400'" class="flex-1 min-w-[66px] snap-start py-2 lg:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition">Заявки <span v-if="pendingIn.length" class="ml-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px] align-middle">{{ pendingIn.length }}</span></button>
          <button @click="tab='blocked'" :class="tab==='blocked'?'bg-white dark:bg-zinc-700 shadow text-ink-900 dark:text-white':'text-stone-500 dark:text-zinc-400'" class="flex-1 min-w-[58px] snap-start py-2 lg:py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition">Блок<span v-if="blocked.length" class="ml-1 bg-stone-500 text-white px-1.5 py-0.5 rounded-full text-[10px] align-middle">{{ blocked.length }}</span></button>
        </div>
        <div class="mt-3 relative">
          <input v-model="searchQuery" placeholder="Поиск людей..." class="w-full pl-9 pr-3 py-3 lg:py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl lg:rounded-full text-[15px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <span class="absolute left-3 top-3.5 lg:top-2.5 text-stone-400">⌕</span>
          <span v-if="searching" class="absolute right-3 top-3 lg:top-2.5 w-4 h-4 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span>
        </div>
        <div v-if="searchResults.length" class="mt-2 max-h-[42dvh] lg:max-h-48 overflow-auto divide-y dark:divide-zinc-800 border rounded-2xl bg-white dark:bg-zinc-900 shadow-sm">
          <div v-for="u in searchResults" :key="u.id" class="flex items-center justify-between p-3 lg:p-2 hover:bg-stone-50 dark:hover:bg-zinc-800 select-none" v-bind="bindSheet({type:'search', data:u})">
            <Link :href="`/users/${u.id}`" class="flex items-center gap-2.5 hover:opacity-80 min-w-0">
              <span class="relative shrink-0">
                <img :src="u.avatar_path?`/storage/${u.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F172A&color=fff`" class="w-9 h-9 lg:w-8 lg:h-8 rounded-full object-cover" />
                <OnlineDot :online="isOnline(u.id)" size="w-3 h-3" />
              </span>
              <div class="min-w-0"><div class="text-sm font-medium dark:text-white truncate hover:underline flex items-center gap-1">{{ u.name }}<span v-if="isOnline(u.id)" class="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span></div><div class="text-xs truncate flex items-center gap-1"><span :class="isOnline(u.id)?'text-emerald-600':'text-stone-400'">{{ isOnline(u.id) ? '● в сети' : '○ офлайн' }}</span><span class="text-stone-300">·</span><span :class="u.can_message?'text-emerald-600':'text-red-500'">{{ u.can_message?'можно написать':'не принимает' }}</span></div></div>
            </Link>
            <div class="flex gap-1 shrink-0 ml-2 items-center">
              <button v-if="u.can_message!==false" @click="startChatWith(u)" :disabled="creatingChat" title="Написать" class="w-8 h-8 grid place-items-center rounded-full bg-stone-900 dark:bg-white dark:text-zinc-900 text-white active:scale-95 disabled:opacity-40 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              </button>
              <button @click.stop="friendsApi.add(u.id)" title="В друзья" class="w-8 h-8 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-violet-50 text-stone-500 hover:text-violet-600 active:scale-95 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              </button>
              <button @click.stop="askBlock(u.id, u.name)" title="Заблокировать" class="w-8 h-8 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 active:scale-95 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-auto overscroll-contain">
        <div v-if="tab==='chats'" class="divide-y dark:divide-zinc-800">
          <div v-if="!conversations.length" class="p-10 lg:p-8 text-center">
            <div class="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto mb-3 text-xl">💬</div>
            <div class="text-sm font-semibold dark:text-white">Нет чатов</div>
            <div class="text-xs text-stone-500 mt-1">Найдите человека через поиск выше</div>
          </div>
          <div v-for="c in conversations" :key="c.id" class="group w-full flex items-center gap-0 hover:bg-stone-50 dark:hover:bg-zinc-800 text-left select-none active:bg-stone-100 dark:active:bg-zinc-800" v-bind="bindSheet({type:'chat', data:c})">
            <button @click="openConversation(c.id)" :class="selectedId===c.id?'lg:bg-violet-50 dark:lg:bg-zinc-800':''" class="flex-1 flex items-center gap-3 p-3.5 lg:p-3 text-left min-w-0">
              <span class="relative shrink-0">
                <img :src="c.other?.avatar_path?`/storage/${c.other.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(c.other?.name||'?')}&background=0F172A&color=fff`" class="w-11 h-11 lg:w-10 lg:h-10 rounded-full object-cover" />
                <OnlineDot :online="isOnline(c.other?.id)" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline gap-2"><span class="text-[15px] lg:text-sm font-semibold dark:text-white truncate flex items-center gap-1">{{ c.other?.name||'Чат' }}<span v-if="isOnline(c.other?.id)" class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span></span><span v-if="c.last_message_at" class="text-[11px] text-stone-400 shrink-0">{{ formatTime(c.last_message_at) }}</span></div>
                <div class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5" :class="isOnline(c.other?.id) ? 'text-emerald-600' : 'text-stone-500'">{{ isOnline(c.other?.id) ? '● в сети' : '○ офлайн' }}<span class="text-stone-300">·</span><span class="truncate text-stone-500">{{ c.last_message?.body||'Нет сообщений' }}</span><span v-if="(c.last_message as any)?.is_edited" class="text-[10px] text-stone-400">(изм.)</span></div>
              </div>
              <span v-if="c.unread_count" class="bg-violet-600 text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0">{{ c.unread_count>99?'99+':c.unread_count }}</span>
            </button>
            <div class="flex items-center gap-1 pr-2 shrink-0">
              <button @click.stop="askDeleteChat(c.id)" title="Удалить чат" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-stone-500 hover:text-red-600 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
              <button v-if="c.other?.id" @click.stop="askBlock(c.other.id, c.other.name)" title="Заблокировать" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 text-stone-500 hover:text-red-600 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div v-if="tab==='friends'" class="divide-y dark:divide-zinc-800">
          <div v-if="!friends.length" class="p-10 text-center text-sm text-stone-500">Нет друзей</div>
          <div v-for="f in friends" :key="f.id" class="flex items-center justify-between p-3.5 lg:p-3 select-none active:bg-stone-50 group" v-bind="bindSheet({type:'friend', data:f})">
            <Link :href="`/users/${f.other.id}`" class="flex items-center gap-3 hover:opacity-80 min-w-0">
              <span class="relative shrink-0">
                <img :src="f.other.avatar_path?`/storage/${f.other.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(f.other.name)}&background=0F172A&color=fff`" class="w-10 h-10 lg:w-9 lg:h-9 rounded-full" />
                <OnlineDot :online="isOnline(f.other.id)" />
              </span>
              <span class="text-[15px] lg:text-sm font-medium dark:text-white truncate hover:underline flex items-center gap-1">{{ f.other.name }}<span v-if="isOnline(f.other.id)" class="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span></span>
            </Link>
            <div class="flex gap-1 shrink-0 items-center">
              <button @click="startChatWith(f.other)" class="text-xs px-3 py-1.5 rounded-full bg-stone-900 dark:bg-white dark:text-zinc-900 text-white font-semibold flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                Чат
              </button>
              <button @click.stop="askRemoveFriend(f)" title="Удалить из друзей" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM6 14a6 6 0 00-6 6h12a6 6 0 00-6-6z"/><path stroke-linecap="round" d="M16 11h5M21 11h-5"/></svg>
              </button>
              <button @click.stop="askBlock(f.other.id, f.other.name)" title="Заблокировать" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div v-if="tab==='requests'" class="divide-y dark:divide-zinc-800">
          <div v-if="!pendingIn.length" class="p-10 text-center text-sm text-stone-500">Нет заявок</div>
          <div v-for="r in pendingIn" :key="r.id" class="flex items-center justify-between p-3.5 lg:p-3 gap-2 select-none" v-bind="bindSheet({type:'request', data:r})">
            <Link :href="`/users/${r.requester.id}`" class="flex items-center gap-3 hover:opacity-80 min-w-0">
              <span class="relative shrink-0">
                <img :src="r.requester.avatar_path?`/storage/${r.requester.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(r.requester.name)}&background=0F172A&color=fff`" class="w-10 h-10 lg:w-9 lg:h-9 rounded-full" />
                <OnlineDot :online="isOnline(r.requester.id)" />
              </span>
              <span class="text-[15px] lg:text-sm dark:text-white truncate hover:underline flex items-center gap-1">{{ r.requester.name }}<span v-if="isOnline(r.requester.id)" class="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span></span>
            </Link>
            <div class="flex gap-1.5 shrink-0">
              <button @click="friendsApi.accept(r.id)" class="text-xs px-3.5 py-2 rounded-full bg-green-600 text-white font-semibold active:scale-95">Принять</button>
              <button @click="friendsApi.decline(r.id)" class="text-xs px-3 py-2 rounded-full border bg-white dark:bg-zinc-800">Отклонить</button>
            </div>
          </div>
        </div>

        <div v-if="tab==='blocked'" class="divide-y dark:divide-zinc-800">
          <div v-if="!blocked.length" class="p-10 text-center text-sm text-stone-500">Нет заблокированных</div>
          <div v-for="b in blocked" :key="b.id" class="flex items-center justify-between p-3.5 lg:p-3">
            <div class="flex items-center gap-3 min-w-0">
              <img :src="b.blocked.avatar_path?`/storage/${b.blocked.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(b.blocked.name)}&background=0F172A&color=fff`" class="w-10 h-10 lg:w-9 lg:h-9 rounded-full shrink-0" />
              <span class="text-[15px] lg:text-sm dark:text-white truncate">{{ b.blocked.name }}</span>
            </div>
            <button @click="askUnblock(b.blocked.id)" class="text-xs px-3.5 py-2 rounded-full border bg-white dark:bg-zinc-800 shrink-0">Разблокировать</button>
          </div>
        </div>
      </div>

      <div class="shrink-0 border-t dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50">
        <button @click="showPrivacy=!showPrivacy" class="w-full flex items-center justify-between px-3 py-3 lg:py-2.5 text-left active:bg-stone-100 dark:active:bg-zinc-800 lg:cursor-default">
          <span class="text-xs font-bold flex items-center gap-1.5">Приватность</span>
          <span class="lg:hidden text-stone-400 text-xs">{{ showPrivacy ? '▲' : '▼' }}</span>
          <span class="hidden lg:block text-[11px] text-stone-500">{{ privacy.message_privacy==='everyone' ? 'Все' : privacy.message_privacy==='friends' ? 'Друзья' : 'Никто' }}</span>
        </button>
        <div :class="showPrivacy ? 'block' : 'hidden lg:block'" class="px-3 pb-3 space-y-2">
          <select v-model="privacy.message_privacy" @change="savePrivacy" class="w-full text-sm lg:text-xs rounded-xl lg:rounded-lg border px-3 py-3 lg:px-2 lg:py-1.5 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-violet-500 focus:outline-none">
            <option value="everyone">Все могут писать</option>
            <option value="friends">Только друзья</option>
            <option value="none">Никто</option>
          </select>
          <label class="flex items-center gap-2.5 text-xs p-3 lg:p-2 rounded-xl lg:rounded-lg border bg-white dark:bg-zinc-900">
            <input type="checkbox" v-model="privacy.allow_random_messages" @change="savePrivacy" :disabled="privacy.message_privacy!=='everyone'" class="w-4 h-4 lg:w-3.5 lg:h-3.5 rounded" />
            <span :class="privacy.message_privacy!=='everyone'?'opacity-50':''" class="text-[13px] lg:text-xs">Разрешить рандомным писать</span>
          </label>
        </div>
      </div>
    </div>

    <div :class="selectedId ? 'flex' : 'hidden lg:flex'" class="flex-1 bg-white dark:bg-zinc-900 lg:rounded-2xl lg:border border-stone-200 dark:border-zinc-800 flex-col overflow-hidden min-h-0">
      <div v-if="!selectedId" class="hidden lg:grid flex-1 place-items-center text-stone-400 text-sm p-8 text-center">
        <div>
          <div class="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto text-2xl mb-3">💬</div>
          <div class="font-semibold dark:text-white">Выберите чат</div>
          <div class="text-xs mt-1">Или найдите человека через поиск</div>
        </div>
      </div>
      <template v-else>
        <div class="px-2 lg:px-4 py-2 lg:py-3 border-b dark:border-zinc-800 flex items-center gap-2 lg:gap-3 shrink-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
          <button @click="backToList" class="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-95 shrink-0 -ml-1">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <Link :href="activeConv?.other ? `/users/${activeConv.other.id}` : '#'" class="flex items-center gap-2.5 lg:gap-3 hover:opacity-80 min-w-0 flex-1">
            <span class="relative shrink-0">
              <img :src="activeConv?.other?.avatar_path?`/storage/${activeConv!.other!.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv?.other?.name||'?')}&background=0F172A&color=fff`" class="w-9 h-9 lg:w-9 lg:h-9 rounded-full" />
              <OnlineDot :online="isOnline(activeConv?.other?.id)" />
            </span>
            <div class="min-w-0"><div class="text-[15px] lg:text-sm font-semibold dark:text-white truncate hover:underline flex items-center gap-1">{{ activeConv?.other?.name }}<span v-if="isOnline(activeConv?.other?.id)" class="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span></div><div v-if="[...typingUsers].some(id=>id===activeConv?.other?.id)" class="text-xs text-violet-600 leading-none">печатает...</div><div v-else class="text-xs leading-none" :class="isOnline(activeConv?.other?.id) ? 'text-emerald-600' : 'text-stone-400'">{{ isOnline(activeConv?.other?.id) ? '● в сети' : '○ офлайн' }}</div></div>
          </Link>
          <div class="flex items-center gap-0.5 lg:gap-1 shrink-0">
            <button @click="refresh" :disabled="refreshing" title="Обновить" class="w-9 h-9 lg:w-8 lg:h-8 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-95 disabled:opacity-50">
              <svg :class="['w-5 h-5 lg:w-4 lg:h-4', refreshing ? 'animate-spin' : '']" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button @click="askDeleteChat()" title="Удалить чат" class="hidden lg:grid w-8 h-8 place-items-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-stone-400 hover:text-red-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
            <button v-if="activeConv?.other" @click="askBlock(activeConv.other.id, activeConv.other.name)" title="Заблокировать" class="hidden lg:grid w-8 h-8 place-items-center rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 text-stone-400 hover:text-red-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
            </button>
            <div class="relative">
              <button @click="showChatMenu=!showChatMenu" class="w-9 h-9 lg:w-8 lg:h-8 grid place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-95 text-lg leading-none">⋯</button>
              <div v-if="showChatMenu" class="absolute right-0 top-10 w-52 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-2xl shadow-xl py-1.5 z-20">
                <button @click="showChatMenu=false; askDeleteChat()" class="w-full text-left px-4 py-3 lg:py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  Удалить чат
                </button>
                <button v-if="activeConv?.other" @click="showChatMenu=false; askBlock(activeConv.other.id, activeConv.other.name)" class="w-full text-left px-4 py-3 lg:py-2.5 text-sm hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
                  Заблокировать
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="showChatMenu" @click="showChatMenu=false" class="fixed inset-0 z-5 lg:hidden"></div>
        <div id="chat-messages" class="flex-1 overflow-auto overscroll-contain p-3 lg:p-4 space-y-2.5 lg:space-y-2 bg-stone-50/50 dark:bg-zinc-950/30">
          <div v-if="loading" class="flex justify-center py-6"><span class="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span></div>
          <div v-for="m in messages" :key="m.id" :class="isOwnMessage(m) ? 'flex justify-end' : 'flex justify-start'">
            <div class="group relative max-w-[82%] sm:max-w-[72%] lg:max-w-[68%] select-none" v-bind="bindSheet({type:'message', data:m})">
              <div v-if="editingId===m.id" class="bg-white dark:bg-zinc-800 border rounded-2xl p-2.5 shadow-lg min-w-[260px] max-w-[86vw]">
                <input ref="editInputRef" v-model="editingBody" @keydown.enter.prevent="saveEdit" @keydown.escape="cancelEdit" class="w-full px-3.5 py-3 lg:py-2 rounded-xl border dark:border-zinc-700 dark:bg-zinc-900 text-[15px] lg:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" placeholder="Сообщение..." />
                <div class="flex gap-1.5 mt-2.5 justify-between items-center flex-wrap">
                  <div class="flex gap-1">
                    <button v-for="e in EMOJI_GROUPS[0].emojis.slice(0,6)" :key="e" @click="onPickEmojiForEdit(e)" class="w-8 h-8 lg:w-7 lg:h-7 grid place-items-center hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-xl lg:rounded-lg text-[16px] lg:text-sm active:scale-95">{{ e }}</button>
                  </div>
                  <div class="flex gap-2 ml-auto">
                    <button @click="cancelEdit" class="px-4 py-2 rounded-full border bg-white dark:bg-zinc-900 text-sm lg:text-xs font-medium active:scale-95">Отмена</button>
                    <button @click="saveEdit" :disabled="!editingBody.trim()" class="px-4 py-2 rounded-full bg-violet-600 text-white text-sm lg:text-xs font-semibold disabled:opacity-40 active:scale-95">Сохранить</button>
                  </div>
                </div>
              </div>
              <div v-else :class="[
                'rounded-[18px] lg:rounded-2xl px-3.5 py-2.5 lg:px-3 lg:py-2 text-[15px] lg:text-sm leading-[1.4] shadow-sm transition-all duration-300',
                isOwnMessage(m) ? 'bg-violet-600 text-white rounded-br-[6px]' : 'bg-white dark:bg-zinc-800 dark:text-white border border-stone-200 dark:border-zinc-700 rounded-bl-[6px]',
                (m as any).pending ? 'opacity-60 scale-[0.98]' : 'opacity-100 scale-100',
                (m as any).failed ? '!bg-red-500' : '',
                (m as any).justSent ? 'ring-2 ring-violet-300' : ''
              ]">
                <div class="whitespace-pre-wrap break-words flex items-end gap-1.5">{{ m.body }}<span v-if="(m as any).pending" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0 mb-0.5"></span><span v-if="(m as any).failed" class="text-[11px]">✕</span></div>
                <div :class="isOwnMessage(m) ? 'text-violet-100' : 'text-stone-400'" class="text-[11px] lg:text-[10px] mt-1 text-right flex items-center justify-end gap-1">{{ formatTime(m.created_at) }}<span v-if="(m as any).is_edited" class="opacity-70">· изм.</span><span v-if="(m as any).pending" class="opacity-70">· отправка</span><span v-if="(m as any).failed" class="text-red-100">· ошибка</span></div>
              </div>
              <div v-if="editingId!==m.id && isOwnMessage(m) && !(m as any).pending" class="absolute -left-16 top-1/2 -translate-y-1/2 hidden lg:group-hover:flex gap-1">
                <button @click="handleStartEdit(m)" class="w-7 h-7 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border shadow text-xs hover:scale-105 transition" title="Редактировать">✎</button>
              </div>
            </div>
          </div>
        </div>
        <div class="p-2 lg:p-3 border-t dark:border-zinc-800 relative bg-white dark:bg-zinc-900 shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:pb-3">
          <div v-if="emojiOpen" class="absolute bottom-full left-2 right-2 lg:left-3 lg:right-3 mb-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-[20px] lg:rounded-2xl shadow-xl p-3 z-10 max-h-[46dvh] lg:max-h-[220px] overflow-auto overscroll-contain">
            <div v-for="g in EMOJI_GROUPS" :key="g.label" class="mb-2 last:mb-0">
              <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 mb-1.5">{{ g.label }}</div>
              <div class="flex flex-wrap gap-1">
                <button v-for="e in g.emojis" :key="e" @click="onPickEmoji(e)" class="w-10 h-10 lg:w-8 lg:h-8 grid place-items-center hover:bg-stone-100 dark:hover:bg-zinc-700 active:bg-violet-100 rounded-xl lg:rounded-lg text-[20px] lg:text-lg leading-none transition active:scale-90">{{ e }}</button>
              </div>
            </div>
          </div>
          <div class="flex gap-2 items-end">
            <button @click="toggleEmoji" :class="emojiOpen ? 'bg-violet-600 text-white border-violet-600' : 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400 border-stone-200 dark:border-zinc-700'" class="w-11 h-11 lg:w-10 lg:h-10 shrink-0 grid place-items-center rounded-full border active:scale-95 transition text-[20px] lg:text-lg shrink-0">😊</button>
            <input ref="inputRef" v-model="input" @input="notifyTyping" @blur="stopTyping" @keydown.enter.prevent="handleSend" @keydown.escape="emoji.close()" placeholder="Сообщение..." class="flex-1 px-4 py-3 lg:py-2.5 rounded-full border dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-[16px] lg:text-sm focus:outline-none focus:border-stone-300 dark:focus:border-zinc-600 placeholder:text-stone-400" enterkeyhint="send" />
            <button @click="handleSend" :disabled="sending || !input.trim()" class="w-11 h-11 lg:w-auto lg:px-6 lg:py-2.5 shrink-0 grid place-items-center lg:inline-flex rounded-full bg-stone-900 dark:bg-white dark:text-zinc-900 text-white font-semibold disabled:opacity-40 active:scale-95 transition shadow-sm"> <span class="hidden lg:inline">➤</span><span class="lg:hidden text-[18px]">↑</span></button>
          </div>
        </div>
      </template>
    </div>
  </div>
</div>

<Dialog v-model:visible="confirmVisible" modal :closable="true" :draggable="false" :style="{width:'360px', maxWidth:'calc(100vw - 2rem)'}" :pt="{ header:{class:'!pb-2'}, content:{class:'!pt-0'} }">
  <template #header>
    <div class="flex items-center gap-3">
      <span class="w-9 h-9 rounded-full grid place-items-center text-lg shrink-0" :class="confirm?.severity==='danger' ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'">{{ confirm?.icon }}</span>
      <span class="font-bold text-[15px] dark:text-white">{{ confirm?.title }}</span>
    </div>
  </template>
  <p class="text-sm text-stone-600 dark:text-zinc-300 leading-relaxed">{{ confirm?.msg }}</p>
  <template #footer>
    <div class="flex justify-end gap-2">
      <Button label="Отмена" severity="secondary" text @click="confirm=null" />
      <Button :label="confirm?.confirmLabel" :severity="confirm?.severity" @click="doConfirm" />
    </div>
  </template>
</Dialog>

<div v-if="sheet" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeSheet"></div>
  <div class="relative w-full sm:max-w-[360px] bg-white dark:bg-zinc-900 rounded-t-[24px] sm:rounded-2xl shadow-2xl border dark:border-zinc-800 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-2 max-h-[80dvh] overflow-auto">
    <div class="w-10 h-1 rounded-full bg-stone-200 dark:bg-zinc-700 mx-auto my-2.5 shrink-0"></div>
    <div class="px-2 pb-2 space-y-1">
      <template v-if="sheet.type==='message'">
        <button v-if="isOwnMessage(sheet.data)" @click="closeSheet(); handleStartEdit(sheet.data)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-zinc-800 active:bg-stone-100 text-[15px] font-medium text-left">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Редактировать
        </button>
        <button v-if="isOwnMessage(sheet.data)" @click="closeSheet(); confirm = { type:'deleteMessage', payload:sheet.data.id, title:'Удалить сообщение?', msg:'Удалить?', icon:'🗑️', confirmLabel:'Удалить', severity:'danger' }" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 text-[15px] font-medium text-left text-red-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Удалить сообщение
        </button>
        <button class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 active:bg-stone-200 text-[15px] font-medium text-left justify-center mt-1" @click="closeSheet">Отмена</button>
      </template>
      <template v-else-if="sheet.type==='chat'">
        <div class="px-4 py-3 border-b dark:border-zinc-800 mb-1"><div class="text-[15px] font-bold dark:text-white truncate">{{ sheet.data.other?.name }}</div></div>
        <button @click="closeSheet(); openConversation(sheet.data.id)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-violet-50 dark:hover:bg-zinc-800 active:bg-violet-100 text-[15px] font-medium text-left text-violet-700">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          Открыть чат
        </button>
        <button @click="askDeleteChat(sheet.data.id)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 text-[15px] font-medium text-left text-red-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Удалить чат
        </button>
        <button v-if="sheet.data.other?.id" @click="askBlock(sheet.data.other.id, sheet.data.other.name)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 text-[15px] font-medium text-left text-red-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
          Заблокировать
        </button>
        <button @click="closeSheet" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-[15px] font-medium text-left justify-center mt-1">Отмена</button>
      </template>
      <template v-else-if="sheet.type==='friend'">
        <div class="px-4 py-2 border-b dark:border-zinc-800 mb-1"><div class="text-[15px] font-bold dark:text-white">{{ sheet.data.other.name }}</div></div>
        <button @click="closeSheet(); startChatWith(sheet.data.other)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-violet-50 dark:hover:bg-zinc-800 text-[15px] font-medium text-left text-violet-700">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          Написать
        </button>
        <button @click="askRemoveFriend(sheet.data)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 text-[15px] font-medium text-left text-red-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM6 14a6 6 0 00-6 6h12a6 6 0 00-6-6z"/><path stroke-linecap="round" d="M16 11h5"/></svg>
          Удалить из друзей
        </button>
        <button @click="askBlock(sheet.data.other.id, sheet.data.other.name)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 text-[15px] font-medium text-left text-red-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
          Заблокировать
        </button>
        <button @click="closeSheet" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-[15px] font-medium text-left justify-center mt-1">Отмена</button>
      </template>
      <template v-else-if="sheet.type==='request'">
        <div class="px-4 py-2 border-b dark:border-zinc-800 mb-1"><div class="text-[15px] font-bold dark:text-white">{{ sheet.data.requester.name }}</div><div class="text-xs text-stone-500">хочет дружить</div></div>
        <button @click="closeSheet(); friendsApi.accept(sheet.data.id)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-green-600 active:bg-green-700 text-white text-[15px] font-medium text-left">✅ Принять</button>
        <button @click="friendsApi.decline(sheet.data.id); closeSheet()" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-zinc-800 text-[15px] font-medium text-left">❌ Отклонить</button>
        <button @click="closeSheet" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-[15px] font-medium text-left justify-center mt-1">Отмена</button>
      </template>
      <template v-else-if="sheet.type==='search'">
        <div class="px-4 py-2 border-b dark:border-zinc-800 mb-1"><div class="text-[15px] font-bold dark:text-white">{{ sheet.data.name }}</div></div>
        <button v-if="sheet.data.can_message!==false" @click="closeSheet(); startChatWith(sheet.data)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-violet-50 dark:hover:bg-zinc-800 text-[15px] font-medium text-left text-violet-700">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          Написать
        </button>
        <button @click="closeSheet(); friendsApi.add(sheet.data.id)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-zinc-800 text-[15px] font-medium text-left">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          В друзья
        </button>
        <button @click="askBlock(sheet.data.id, sheet.data.name)" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/20 text-[15px] font-medium text-left text-red-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
          Заблокировать
        </button>
        <button @click="closeSheet" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-zinc-800 text-[15px] font-medium text-left justify-center mt-1">Отмена</button>
      </template>
    </div>
  </div>
</div>

</AuthenticatedLayout>
</template>
