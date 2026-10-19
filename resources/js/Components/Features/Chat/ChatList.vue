<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Dialog from 'primevue/dialog'
import VirtualScroller from 'primevue/virtualscroller'
import ProgressSpinner from 'primevue/progressspinner'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import MessageTicks from '@/Components/Features/Feedback/MessageTicks.vue'
import OrgBadge from '@/Components/Features/Chat/OrgBadge.vue'
import UserAvatar from '@/Components/Ui/Media/UserAvatar.vue'
import { useChatListTicks } from '@/composables/useChatListTicks'
import { useChatPreview } from '@/composables/useChatPreview'
import { useChatRowMenu } from '@/composables/useChatRowMenu'
import { useChatDirectList } from '@/composables/useChatDirectList'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useProfileUrl } from '@/composables/useProfileUrl'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'

const props = withDefaults(defineProps<{ conversations: any[]; uloveConversations?: any[]; friends: any[]; pendingIn: any[]; blocked: any[]; tab: string; selectedId: number | null; isSavedOpen?: boolean; filter: string; conversationsSentinel?: unknown; conversationsHasMore?: boolean; conversationsLoadingMore?: boolean; directHasMore?: boolean; directLoadingMore?: boolean; directLoadMore?: (onlyMatched: boolean) => Promise<unknown>; uloveOnly?: boolean; friendsSentinel?: unknown; friendsHasMore?: boolean; friendsLoadingMore?: boolean; isOnline: (id?: number, lastSeenAt?: string | null) => boolean; formatTime: (s: string) => string }>(), { conversationsHasMore: false, conversationsLoadingMore: false, directHasMore: false, directLoadingMore: false, uloveOnly: false, friendsHasMore: false, friendsLoadingMore: false, isSavedOpen: false })

/**
 * Direct-диалоги: виртуальный скролл + догрузка страниц по мере прокрутки.
 * В чистом ULove-режиме все личные диалоги и так мэтчи — серверу шлём
 * only_direct, иначе фильтруем по мэтчам, чтобы страница не была пустой.
 */
const direct = useChatDirectList({
  conversations: () => props.uloveConversations ?? [],
  filter: () => props.filter,
  hasMore: () => !!props.directHasMore,
  loading: () => !!props.directLoadingMore,
  loadMore: () => props.directLoadMore?.(!props.uloveOnly),
})
const {
  items: directItems,
  itemSize: directItemSize,
  onScroll: onDirectScroll,
  onLazyLoad: onDirectLazyLoad,
  canLoadMoreManually: canLoadMoreDirect,
  loadMoreManually: loadMoreDirect,
} = direct
const emit = defineEmits<{ (e: 'update:filter', v: string): void; (e: 'saved'): void; (e: 'open', id: number): void; (e: 'startChat', u: any): void; (e: 'toggleChatPin', id: number, isPinned: boolean): void; (e: 'deleteChat', id: number): void; (e: 'block', id: number, name?: string): void; (e: 'unblock', id: number): void; (e: 'removeFriend', f: any): void; (e: 'accept', id: number): void; (e: 'decline', id: number): void; (e: 'sheet', p: any): void }>()

/**
 * Показывать ли закреп «Избранное» наверху вкладки чатов.
 */
const showSavedPin = computed(() => {
  if (props.tab !== 'chats') {
    return false
  }
  const q = (props.filter || '').trim().toLowerCase()
  if (!q) {
    return true
  }
  return 'избранное'.includes(q) || 'заметки'.includes(q) || 'себе'.includes(q)
})

const { previewText } = useChatPreview(Number((usePage().props.auth as any)?.user?.id ?? 0))
const currentUserId = Number((usePage().props.auth as any)?.user?.id ?? 0)
const ticks = useChatListTicks(() => currentUserId)
const rowMenu = useChatRowMenu({
  onTogglePin: (id: number, isPinned: boolean) => emit('toggleChatPin', id, isPinned),
  onDeleteChat: (id: number) => emit('deleteChat', id),
  onBlock: (id: number, name?: string) => emit('block', id, name),
  onRemoveFriend: (f: any) => emit('removeFriend', f),
  onStartChat: (u: any) => emit('startChat', u),
})
const menuAnchor = rowMenu.menu
const { menuPt } = useDropdownMenuStyle()
const { userProfileUrl } = useProfileUrl()
</script>
<template>
  <div class="flex-1 flex flex-col min-h-0 w-full max-w-full">
    <div class="p-2.5 border-b dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50 shrink-0">
      <div class="relative w-full">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none" />
        <input :value="filter" @input="emit('update:filter', ($event.target as HTMLInputElement).value)" placeholder="Поиск по чатам — имя фамилия..." enterkeyhint="search" inputmode="search" autocomplete="off" class="w-full rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 pl-9 pr-9 py-2.5 text-base lg:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        <i v-if="filter" class="pi pi-times absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm cursor-pointer" @click="emit('update:filter', '')" />
      </div>
    </div>
    <div v-if="tab === 'chats'" class="flex-1 min-h-0 overflow-auto overscroll-contain scroll-neat divide-y dark:divide-zinc-800">
      <button v-if="showSavedPin" type="button" @click="emit('saved')" :class="isSavedOpen ? 'bg-amber-50 dark:bg-amber-500/10 shadow-[inset_3px_0_0_0_#f59e0b]' : 'hover:bg-amber-50/60 dark:hover:bg-amber-500/5'" class="w-full flex items-center gap-3 p-3.5 lg:p-3 text-left min-w-0 transition-colors">
        <span class="relative shrink-0">
          <span class="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center text-lg shrink-0">⭐</span>
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-[15px] lg:text-sm font-semibold text-stone-900 dark:text-white truncate">Избранное</span>
          <span class="block text-[13px] lg:text-xs truncate mt-0.5 text-stone-500 dark:text-zinc-400">Заметки, ссылки и файлы — только для себя</span>
        </span>
      </button>
      <div v-if="!conversations.length && !showSavedPin" class="p-6 sm:p-8 text-center">
        <div class="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto mb-3 text-xl">💬</div>
        <div class="text-sm font-semibold text-stone-900 dark:text-white">Нет чатов</div>
        <div class="text-xs text-stone-500 mt-1">Найдите человека через поиск выше</div>
      </div>
      <div v-for="c in conversations" :key="c.id" class="group w-full flex items-center gap-0 text-left select-none">
        <button @click="emit('open', c.id)" :class="selectedId === c.id ? 'bg-stone-100 dark:bg-zinc-800' : c.is_pinned ? 'bg-violet-50/60 dark:bg-violet-500/5 hover:bg-violet-50 dark:hover:bg-violet-500/10' : 'hover:bg-stone-50/70 dark:hover:bg-zinc-800/70'" class="flex-1 flex items-center gap-3 p-3.5 lg:p-3 text-left min-w-0 transition-colors">
          <span class="relative shrink-0">
            <span v-if="c.title" class="w-11 h-11 rounded-full bg-gradient-to-br from-violet-700 to-purple-900 text-white grid place-items-center text-lg shrink-0">🏘️</span>
            <UserAvatar v-else :user="c.other" shape="circle" size="large" class="!w-11 !h-11 [&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" />
            <OnlineDot v-if="!c.title" :online="isOnline(c.other?.id, c.other?.last_seen_at)" />
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline gap-2"><span class="text-[15px] lg:text-sm font-semibold text-stone-900 dark:text-white truncate">{{ c.title || c.other?.name || 'Чат' }} <OrgBadge :is-organization="c.other?.is_organization" /></span><span class="flex items-center gap-1.5 shrink-0"><i v-if="c.is_pinned" class="pi pi-thumbtack text-[11px] text-violet-500" title="Закреплён" /><span v-if="c.last_message_at" class="text-[11px] text-stone-400">{{ formatTime(c.last_message_at) }}</span></span></div>
            <div v-if="c.title" class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5 text-violet-600">🏘️ Общий чат района<span class="text-stone-300">·</span><MessageTicks v-if="ticks.isOwnLast(c)" :status="ticks.lastMessageStatus(c) ?? 'sent'" /><span class="truncate text-stone-500 dark:text-zinc-400">{{ previewText(c.last_message) }}</span></div>
            <div v-else class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5"><MessageTicks v-if="ticks.isOwnLast(c)" :status="ticks.lastMessageStatus(c) ?? 'sent'" /><span class="truncate text-stone-500 dark:text-zinc-400">{{ previewText(c.last_message, isOnline(c.other?.id, c.other?.last_seen_at) ? 'в сети' : 'Начни общение') }}</span><span v-if="(c.last_message as any)?.is_edited" class="text-[10px] text-stone-400">(изм.)</span></div>
          </div>
          <span v-if="c.unread_count" class="bg-[#F04D9F] text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0">{{ c.unread_count > 9 ? '9+' : c.unread_count }}</span>
        </button>
        <div class="flex items-center ml-1 pr-2 shrink-0">
          <Button @click.stop="(e: Event) => rowMenu.open(e, { kind: 'chat', id: c.id, userId: c.other?.id, userName: c.other?.name, isPinned: !!c.is_pinned })" icon="pi pi-ellipsis-h" text rounded severity="secondary" class="!w-7 !h-7 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Меню чата" title="Меню чата" />
        </div>
      </div>
      <InfiniteSentinel :sentinel="conversationsSentinel as any" :has-more="!!conversationsHasMore" :loading="!!conversationsLoadingMore" end-text="Это все чаты" />
    </div>
    <div v-if="tab === 'ulove'" class="flex-1 min-h-0 relative">
      <VirtualScroller
        :items="directItems"
        :item-size="directItemSize"
        scroll-height="100%"
        lazy
        class="absolute inset-0 w-full"
        :pt="{ content: { class: 'w-full pb-14' } }"
        @scroll="onDirectScroll"
        @lazy-load="onDirectLazyLoad"
      >
        <template #item="{ item: c }">
          <div :key="c.id" class="group w-full flex items-center gap-0 h-[73px] lg:h-[69px] border-b border-stone-100 dark:border-zinc-800 text-left select-none">
            <button @click="emit('open', c.id)" :class="selectedId === c.id ? 'bg-rose-50 dark:bg-rose-500/10 shadow-[inset_3px_0_0_0_#f43f5e]' : 'hover:bg-rose-50/70 dark:hover:bg-rose-950/20'" class="flex-1 h-full flex items-center gap-3 px-3.5 lg:px-3 text-left min-w-0 transition-colors">
              <span class="relative shrink-0">
                <UserAvatar :user="c.other" shape="circle" size="large" :class="['!w-11 !h-11 [&_img]:object-cover', c.other?.is_match ? 'ring-2 ring-rose-300 dark:ring-rose-700' : '']" :pt="{ image: { class: 'object-cover' } }" />
                <OnlineDot :online="isOnline(c.other?.id, c.other?.last_seen_at)" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline gap-2"><span class="text-[15px] lg:text-sm font-semibold text-stone-900 dark:text-white truncate">{{ c.other?.name || 'Чат' }}</span><span class="flex items-center gap-1.5 shrink-0"><i v-if="c.is_pinned" class="pi pi-thumbtack text-[11px] text-rose-400" title="Закреплён" /><span v-if="c.last_message_at" class="text-[11px] text-stone-400">{{ formatTime(c.last_message_at) }}</span></span></div>
                <div v-if="c.other?.is_match" class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5"><span class="text-rose-500 font-bold">Мэтч</span><span class="text-stone-300">·</span><MessageTicks v-if="ticks.isOwnLast(c)" :status="ticks.lastMessageStatus(c) ?? 'sent'" /><span class="truncate text-stone-500 dark:text-zinc-400">{{ previewText(c.last_message, 'Чат открыт — напиши первым') }}</span><span v-if="(c.last_message as any)?.is_edited" class="text-[10px] text-stone-400">(изм.)</span></div>
                <div v-else class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5"><MessageTicks v-if="ticks.isOwnLast(c)" :status="ticks.lastMessageStatus(c) ?? 'sent'" /><span class="truncate text-stone-500 dark:text-zinc-400">{{ previewText(c.last_message, isOnline(c.other?.id, c.other?.last_seen_at) ? 'в сети' : 'Начни общение') }}</span><span v-if="(c.last_message as any)?.is_edited" class="text-[10px] text-stone-400">(изм.)</span></div>
              </div>
              <span v-if="c.unread_count" class="bg-[#F04D9F] text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0">{{ c.unread_count > 9 ? '9+' : c.unread_count }}</span>
            </button>
            <div class="flex items-center ml-1 pr-2 shrink-0">
              <Button @click.stop="(e: Event) => rowMenu.open(e, { kind: 'chat', id: c.id, userId: c.other?.id, userName: c.other?.name, isPinned: !!c.is_pinned })" icon="pi pi-ellipsis-h" text rounded severity="secondary" class="!w-7 !h-7 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Меню чата" title="Меню чата" />
            </div>
          </div>
        </template>
      </VirtualScroller>
      <div v-if="!directItems.length && !directLoadingMore" class="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-white dark:bg-zinc-900">
        <div class="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 grid place-items-center mb-3 text-xl">💞</div>
        <div class="text-sm font-semibold text-stone-900 dark:text-white">Пока нет диалогов</div>
        <div class="text-xs text-stone-500 mt-1">Начни общение — новые переписки появятся здесь</div>
        <Button v-if="canLoadMoreDirect" label="Показать ещё" icon="pi pi-arrow-down" size="small" rounded outlined class="!mt-4" @click="loadMoreDirect" />
      </div>
      <div v-if="directItems.length && (directLoadingMore || canLoadMoreDirect)" class="absolute bottom-0 inset-x-0 z-10 flex justify-center py-2.5 border-t border-stone-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm">
        <ProgressSpinner v-if="directLoadingMore" :style="{ width: '24px', height: '24px' }" :stroke-width="5" aria-label="Загрузка" />
        <Button v-else-if="canLoadMoreDirect" label="Показать ещё" icon="pi pi-arrow-down" size="small" rounded outlined @click="loadMoreDirect" />
      </div>
    </div>
    <div v-if="tab === 'friends'" class="flex-1 min-h-0 overflow-auto overscroll-contain scroll-neat divide-y dark:divide-zinc-800">
      <div v-if="!friends.length" class="p-6 text-center text-sm text-stone-500">Нет друзей</div>
      <div v-for="f in friends" :key="f.id" class="flex items-center justify-between p-3.5 lg:p-3 select-none group">
        <Link :href="userProfileUrl(f.other)" class="flex items-center gap-3 hover:opacity-80 min-w-0">
          <span class="relative shrink-0"><UserAvatar :user="f.other" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="isOnline(f.other?.id, (f.other as any)?.last_seen_at)" /></span>
          <span class="text-[15px] lg:text-sm font-medium text-stone-900 dark:text-white truncate hover:underline">{{ f.other?.name }}</span>
        </Link>
        <div class="flex gap-1 shrink-0 items-center">
          <button @click="emit('startChat', f.other)" class="text-xs px-3 py-1.5 rounded-full bg-stone-900 dark:bg-white dark:text-zinc-900 text-white font-semibold">Чат</button>
          <Button @click.stop="(e: Event) => rowMenu.open(e, { kind: 'friend', friendship: f, other: f.other, userId: f.other?.id, userName: f.other?.name })" icon="pi pi-ellipsis-h" text rounded severity="secondary" class="!w-7 !h-7 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Меню" title="Меню" />
        </div>
      </div>
      <InfiniteSentinel :sentinel="friendsSentinel as any" :has-more="!!friendsHasMore" :loading="!!friendsLoadingMore" end-text="Это все друзья" />
    </div>
    <div v-if="tab === 'requests'" class="flex-1 min-h-0 overflow-auto overscroll-contain scroll-neat divide-y dark:divide-zinc-800">
      <div v-if="!pendingIn.length" class="p-6 text-center text-sm text-stone-500">Нет заявок</div>
      <div v-for="r in pendingIn" :key="r.id" class="flex items-center justify-between p-3.5 lg:p-3 gap-2 select-none">
        <Link :href="userProfileUrl(r.requester)" class="flex items-center gap-3 hover:opacity-80 min-w-0">
          <span class="relative shrink-0"><UserAvatar :user="r.requester" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="isOnline(r.requester?.id, (r.requester as any)?.last_seen_at)" /></span>
          <span class="text-[15px] lg:text-sm text-stone-900 dark:text-white truncate hover:underline">{{ r.requester?.name }}</span>
        </Link>
        <div class="flex gap-1.5 shrink-0">
          <button @click="emit('accept', r.id)" class="text-xs px-3.5 py-2 rounded-full bg-green-600 text-white font-semibold active:scale-95">Принять</button>
          <button @click="emit('decline', r.id)" class="text-xs px-3 py-2 rounded-full border border-red-200 bg-white text-red-600 dark:bg-zinc-800 dark:border-red-900 dark:text-red-400">Отклонить</button>
        </div>
      </div>
    </div>
    <div v-if="tab === 'blocked'" class="flex-1 min-h-0 overflow-auto overscroll-contain scroll-neat divide-y dark:divide-zinc-800">
      <div v-if="!blocked.length" class="p-6 text-center text-sm text-stone-500">Нет заблокированных</div>
      <div v-for="b in blocked" :key="b.id" class="flex items-center justify-between p-3.5 lg:p-3">
        <div class="flex items-center gap-3 min-w-0"><UserAvatar :user="b.blocked" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><span class="text-[15px] lg:text-sm text-stone-900 dark:text-white truncate">{{ b.blocked?.name }}</span></div>
        <button v-if="b.blocked?.id" @click="emit('unblock', b.blocked.id)" class="text-xs px-3.5 py-2 rounded-full border bg-white dark:bg-zinc-800 shrink-0">Разблокировать</button>
      </div>
    </div>
    <Menu ref="menuAnchor" :model="(rowMenu.menuModel.value as any)" :popup="true" :pt="menuPt" />
    <Dialog v-model:visible="rowMenu.sheetOpen.value" position="bottom" :draggable="false" :modal="true" :dismissable-mask="true" :show-header="false" :pt="{ root: { class: '!rounded-t-[24px] !rounded-b-none !border-0 !m-0 !max-h-[80dvh] w-full sm:!max-w-[360px]' }, content: { class: '!p-2 !pb-[calc(0.5rem+var(--sab))]' } }">
      <div class="px-2 pb-2 space-y-1">
        <div v-if="rowMenu.target.value?.userName" class="px-4 py-2 text-[15px] font-bold truncate text-stone-900 dark:text-white">{{ rowMenu.target.value.userName }}</div>
        <button v-for="(it, i) in rowMenu.menuModel.value" :key="i" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-white/5 text-[15px] font-medium text-left dark:text-zinc-100" :class="(it as any).danger ? '!text-red-600' : ''" @click="(it as any).command?.()"><i :class="(it as any).icon"></i>{{ (it as any).label }}</button>
        <button type="button" class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-white/10 dark:text-zinc-100 text-[15px] font-medium mt-1" @click="rowMenu.close()">Отмена</button>
      </div>
    </Dialog>
  </div>
</template>
