<script setup lang="ts">
import { toRef } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import ChatList from '@/Components/Features/Chat/ChatList.vue'
import ChatPrivacySelect from '@/Components/Features/Chat/ChatPrivacySelect.vue'
import { useChatLayout } from '@/composables/useChatLayout'
import { useChatPrivacy } from '@/composables/useChatPrivacy'

const { sidebarCardClass } = useChatLayout()

const props = withDefaults(defineProps<{ tab: string; unreadTotal: number; uloveUnread?: number; pendingCount: number; blockedCount: number; refreshing: boolean; conversations: any[]; uloveConversations?: any[]; friends: any[]; pendingIn: any[]; blocked: any[]; filter: string; selectedId: number | null; privacy: any; showPrivacy: boolean; isOnline: (id?: number, lastSeenAt?: string | null) => boolean; formatTime: (s: string) => string; conversationsSentinel?: unknown; conversationsHasMore?: boolean; conversationsLoadingMore?: boolean; friendsSentinel?: unknown; friendsHasMore?: boolean; friendsLoadingMore?: boolean; isBusiness?: boolean; uloveOnly?: boolean }>(), { isBusiness: false, uloveOnly: false })
const emit = defineEmits<{ (e: 'update:tab', v: any): void; (e: 'update:filter', v: string): void; (e: 'update:showPrivacy', v: boolean): void; (e: 'refresh'): void; (e: 'people'): void; (e: 'open', id: number): void; (e: 'startChat', u: any): void; (e: 'deleteChat', id: number): void; (e: 'clearAllChats'): void; (e: 'block', id: number, name?: string): void; (e: 'unblock', id: number): void; (e: 'removeFriend', f: any): void; (e: 'accept', id: number): void; (e: 'decline', id: number): void; (e: 'savePrivacy'): void }>()

const chatPrivacy = useChatPrivacy(toRef(props, 'privacy') as any, toRef(props, 'uloveOnly'))
</script>
<template>
  <div :class="[selectedId ? 'hidden lg:flex' : 'flex', sidebarCardClass]">
    <div class="p-3 border-b dark:border-zinc-800 shrink-0 w-full max-w-full min-w-0">
      <div class="flex items-center gap-2 mb-3">
        <h2 class="text-[15px] font-bold dark:text-white tracking-tight">{{ uloveOnly ? '💞 ULove' : 'UConnect' }}</h2>
        <Button v-if="!uloveOnly" @click="emit('people')" icon="pi pi-users" rounded severity="secondary" outlined class="!w-8 !h-8 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Поиск людей" />
        <Button @click="emit('refresh')" :loading="refreshing" icon="pi pi-refresh" rounded severity="secondary" text class="!w-8 !h-8 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Обновить" />
        <Button v-if="conversations.length" @click="emit('clearAllChats')" icon="pi pi-trash" rounded severity="danger" text class="!w-8 !h-8 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Удалить все чаты" title="Удалить все чаты" />
      </div>
      <Tabs :value="tab" :showNavigators="false" @update:value="(v:any)=>emit('update:tab', v)" class="w-full block chat-tabs">
        <TabList class="!flex-nowrap !overflow-x-auto overscroll-x-contain scrollbar-none snap-x [&_.p-tablist-tab-list]:flex [&_.p-tablist-tab-list]:!justify-between [&_.p-tablist-content]:!border-0">
          <Tab v-if="!uloveOnly" value="chats" class="chat-tab !text-xs !py-2 !px-1 !whitespace-nowrap snap-start shrink-0">Чаты <Badge v-if="unreadTotal" :value="unreadTotal > 9 ? '9+' : String(unreadTotal)" severity="danger" class="ml-1 !text-[10px]" /></Tab>
          <Tab v-if="!isBusiness" value="ulove" class="chat-tab !text-xs !py-2 !px-1 !whitespace-nowrap snap-start shrink-0">💞 ULove <Badge v-if="uloveUnread" :value="uloveUnread > 9 ? '9+' : String(uloveUnread)" severity="danger" class="ml-1 !text-[10px]" /></Tab>
          <Tab v-if="!uloveOnly" value="friends" class="chat-tab !text-xs !py-2 !px-1 !whitespace-nowrap snap-start shrink-0">Друзья</Tab>
          <Tab v-if="!uloveOnly" value="requests" class="chat-tab !text-xs !py-2 !px-1 !whitespace-nowrap snap-start shrink-0">Заявки <Badge v-if="pendingCount" :value="String(pendingCount)" severity="warn" class="ml-1 !text-[10px]" /></Tab>
          <Tab value="blocked" class="chat-tab !text-xs !py-2 !px-1 !whitespace-nowrap snap-start shrink-0">Блок <Badge v-if="blockedCount" :value="String(blockedCount)" severity="secondary" class="ml-1 !text-[10px]" /></Tab>
        </TabList>
      </Tabs>
    </div>
    <ChatList :conversations="conversations" :ulove-conversations="uloveConversations ?? []" :friends="friends" :pending-in="pendingIn" :blocked="blocked" :tab="tab" :selected-id="selectedId" :filter="filter" :conversations-sentinel="conversationsSentinel" :conversations-has-more="conversationsHasMore" :conversations-loading-more="conversationsLoadingMore" :friends-sentinel="friendsSentinel" :friends-has-more="friendsHasMore" :friends-loading-more="friendsLoadingMore" :is-online="isOnline" :format-time="formatTime" @update:filter="(v:string)=>emit('update:filter', v)" @open="(id:number)=>emit('open', id)" @start-chat="(u:any)=>emit('startChat', u)" @delete-chat="(id:number)=>emit('deleteChat', id)" @block="(id:number,n?:string)=>emit('block', id, n)" @unblock="(id:number)=>emit('unblock', id)" @remove-friend="(f:any)=>emit('removeFriend', f)" @accept="(id:number)=>emit('accept', id)" @decline="(id:number)=>emit('decline', id)" />
    <div class="shrink-0 flex-none border-t dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 rounded-b-none lg:rounded-b-2xl overflow-hidden">
      <button @click="emit('update:showPrivacy', !showPrivacy)" class="w-full flex items-center justify-between px-3 py-3 lg:py-2.5 text-left active:bg-stone-100 dark:active:bg-zinc-800 lg:cursor-default">
        <span class="text-xs font-bold flex items-center gap-1.5 dark:text-white">Приватность</span>
        <span class="lg:hidden text-stone-400 text-xs">{{ showPrivacy ? '▲' : '▼' }}</span>
        <span class="hidden lg:block text-[11px] text-stone-500">{{ chatPrivacy.shortLabel.value }}</span>
      </button>
      <div :class="showPrivacy ? 'block' : 'hidden lg:block'" class="px-3 pb-3 max-h-[32dvh] lg:max-h-none overflow-auto overscroll-contain">
        <ChatPrivacySelect :privacy="privacy" :ulove-only="uloveOnly" @save-privacy="emit('savePrivacy')" />
      </div>
    </div>
  </div>
</template>
<style scoped>
.chat-tabs .p-tablist { background: transparent; border: 0; border-radius: 0; padding: 0; }
.chat-tabs .p-tablist-content { padding: 0; border: 0; scrollbar-width: none; -ms-overflow-style: none; }
.chat-tabs .p-tablist-content { padding: 0; scrollbar-width: none; -ms-overflow-style: none; }
.chat-tabs .p-tablist-content::-webkit-scrollbar { display: none; width: 0; height: 0; }
.chat-tabs .p-tablist-active-bar { display: block; height: 3px; border-radius: 9999px; background: #5b5bff; box-shadow: 0 1px 6px rgba(91, 91, 255, 0.5); transition: left 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.chat-tab { background: transparent; border: 0; box-shadow: none; color: #78716c; font-weight: 700; }
.chat-tab:hover { background: transparent; color: #1c1917; }
.chat-tab.p-tab-active { background: transparent; color: #5b5bff; box-shadow: none; }
.chat-tab:focus-visible { outline: none; box-shadow: none; color: #5b5bff; }
:global(.dark) .chat-tab { color: #a1a1aa; }
:global(.dark) .chat-tab:hover { background: transparent; color: #ffffff; }
:global(.dark) .chat-tab.p-tab-active { background: transparent; color: #8186ff; box-shadow: none; }
</style>
