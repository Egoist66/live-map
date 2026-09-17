<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Dialog from 'primevue/dialog'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useChatPreview } from '@/composables/useChatPreview'
import { useChatRowMenu } from '@/composables/useChatRowMenu'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'

const props = withDefaults(defineProps<{ conversations: any[]; uloveConversations?: any[]; friends: any[]; pendingIn: any[]; blocked: any[]; tab: string; selectedId: number | null; filter: string; conversationsSentinel?: unknown; conversationsHasMore?: boolean; conversationsLoadingMore?: boolean; friendsSentinel?: unknown; friendsHasMore?: boolean; friendsLoadingMore?: boolean; isOnline: (id?: number, lastSeenAt?: string | null) => boolean; formatTime: (s: string) => string }>(), { conversationsHasMore: false, conversationsLoadingMore: false, friendsHasMore: false, friendsLoadingMore: false })

/** Мэтчи ULove с учётом строки поиска. */
const filteredUlove = computed(() => {
  const q = (props.filter || '').trim().toLowerCase()
  const list = props.uloveConversations || []
  if (!q) return list.filter((c: any) => !!c)
  return list.filter((c: any) => c && (c.other?.name || '').toLowerCase().includes(q))
})
const emit = defineEmits<{ (e: 'update:filter', v: string): void; (e: 'open', id: number): void; (e: 'startChat', u: any): void; (e: 'deleteChat', id: number): void; (e: 'block', id: number, name?: string): void; (e: 'unblock', id: number): void; (e: 'removeFriend', f: any): void; (e: 'accept', id: number): void; (e: 'decline', id: number): void; (e: 'sheet', p: any): void }>()

const { previewText } = useChatPreview(Number((usePage().props.auth as any)?.user?.id ?? 0))
const rowMenu = useChatRowMenu({
  onDeleteChat: (id: number) => emit('deleteChat', id),
  onBlock: (id: number, name?: string) => emit('block', id, name),
  onRemoveFriend: (f: any) => emit('removeFriend', f),
  onStartChat: (u: any) => emit('startChat', u),
})
const menuAnchor = rowMenu.menu
const { menuPt } = useDropdownMenuStyle()
</script>
<template>
  <div class="flex-1 overflow-auto overscroll-contain [scrollbar-width:thin] max-lg:[-ms-overflow-style:none] max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden min-h-0 w-full max-w-full">
    <div class="p-2.5 border-b dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
      <div class="relative w-full">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none" />
        <input :value="filter" @input="emit('update:filter', ($event.target as HTMLInputElement).value)" placeholder="Поиск по чатам — имя фамилия..." enterkeyhint="search" inputmode="search" autocomplete="off" class="w-full rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 pl-9 pr-9 py-2.5 text-base lg:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        <i v-if="filter" class="pi pi-times absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm cursor-pointer" @click="emit('update:filter', '')" />
      </div>
    </div>
    <div v-if="tab === 'chats'" class="divide-y dark:divide-zinc-800">
      <div v-if="!conversations.length" class="p-6 sm:p-8 text-center">
        <div class="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto mb-3 text-xl">💬</div>
        <div class="text-sm font-semibold dark:text-white">Нет чатов</div>
        <div class="text-xs text-stone-500 mt-1">Найдите человека через поиск выше</div>
      </div>
      <div v-for="c in conversations" :key="c.id" class="group w-full flex items-center gap-0 text-left select-none">
        <button @click="emit('open', c.id)" :class="selectedId === c.id ? 'bg-violet-50 dark:bg-violet-500/10 shadow-[inset_3px_0_0_0_#8b5cf6]' : 'hover:bg-stone-50/70 dark:hover:bg-zinc-800/70'" class="flex-1 flex items-center gap-3 p-3.5 lg:p-3 text-left min-w-0 transition-colors">
          <span class="relative shrink-0">
            <span v-if="c.title" class="w-11 h-11 rounded-full bg-gradient-to-br from-violet-700 to-purple-900 text-white grid place-items-center text-lg shrink-0">🏘️</span>
            <Avatar v-else :image="avatarSrcFor(c.other)" shape="circle" size="large" class="!w-11 !h-11 [&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" />
            <OnlineDot v-if="!c.title" :online="isOnline(c.other?.id, c.other?.last_seen_at)" />
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline gap-2"><span class="text-[15px] lg:text-sm font-semibold dark:text-white truncate">{{ c.title || c.other?.name || 'Чат' }}</span><span v-if="c.last_message_at" class="text-[11px] text-stone-400 shrink-0">{{ formatTime(c.last_message_at) }}</span></div>
            <div v-if="c.title" class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5 text-violet-600">🏘️ Общий чат района<span class="text-stone-300">·</span><span class="truncate text-stone-500">{{ previewText(c.last_message) }}</span></div>
            <div v-else class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5" :class="isOnline(c.other?.id, c.other?.last_seen_at) ? 'text-emerald-600' : 'text-red-500'">{{ isOnline(c.other?.id, c.other?.last_seen_at) ? 'в сети' : 'оффлайн' }}<span class="text-stone-300">·</span><span class="truncate text-stone-500">{{ previewText(c.last_message) }}</span><span v-if="(c.last_message as any)?.is_edited" class="text-[10px] text-stone-400">(изм.)</span></div>
          </div>
          <span v-if="c.unread_count" class="bg-violet-600 text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0">{{ c.unread_count > 9 ? '9+' : c.unread_count }}</span>
        </button>
        <div class="flex items-center ml-1 pr-2 shrink-0">
          <Button @click.stop="(e: Event) => rowMenu.open(e, { kind: 'chat', id: c.id, userId: c.other?.id, userName: c.other?.name })" icon="pi pi-ellipsis-h" text rounded severity="secondary" class="!w-7 !h-7 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Меню чата" title="Меню чата" />
        </div>
      </div>
      <InfiniteSentinel :sentinel="conversationsSentinel as any" :has-more="!!conversationsHasMore" :loading="!!conversationsLoadingMore" end-text="Это все чаты" />
    </div>
    <div v-if="tab === 'ulove'" class="divide-y dark:divide-zinc-800">
      <div v-if="!filteredUlove.length" class="p-6 sm:p-8 text-center">
        <div class="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 grid place-items-center mx-auto mb-3 text-xl">💞</div>
        <div class="text-sm font-semibold dark:text-white">Пока нет мэтчей</div>
        <div class="text-xs text-stone-500 mt-1">Лайкай в ULove — взаимность появится здесь</div>
      </div>
      <div v-for="c in filteredUlove" :key="c.id" class="group w-full flex items-center gap-0 text-left select-none">
        <button @click="emit('open', c.id)" :class="selectedId === c.id ? 'bg-rose-50 dark:bg-rose-500/10 shadow-[inset_3px_0_0_0_#f43f5e]' : 'hover:bg-rose-50/70 dark:hover:bg-rose-950/20'" class="flex-1 flex items-center gap-3 p-3.5 lg:p-3 text-left min-w-0 transition-colors">
          <span class="relative shrink-0">
            <Avatar :image="avatarSrcFor(c.other)" shape="circle" size="large" class="!w-11 !h-11 [&_img]:object-cover ring-2 ring-rose-300 dark:ring-rose-700" :pt="{ image: { class: 'object-cover' } }" />
            <OnlineDot :online="isOnline(c.other?.id, c.other?.last_seen_at)" />
            <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 grid place-items-center ring-2 ring-white dark:ring-zinc-900"><i class="pi pi-heart-fill text-white text-[10px]" /></span>
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline gap-2"><span class="text-[15px] lg:text-sm font-semibold dark:text-white truncate">{{ c.other?.name || 'Мэтч' }}</span><span v-if="c.last_message_at" class="text-[11px] text-stone-400 shrink-0">{{ formatTime(c.last_message_at) }}</span></div>
            <div class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5"><span class="text-rose-500 font-bold">Мэтч</span><span class="text-stone-300">·</span><span class="truncate text-stone-500">{{ previewText(c.last_message, 'Чат открыт — напиши первым') }}</span><span v-if="(c.last_message as any)?.is_edited" class="text-[10px] text-stone-400">(изм.)</span></div>
          </div>
          <span v-if="c.unread_count" class="bg-rose-500 text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0">{{ c.unread_count > 9 ? '9+' : c.unread_count }}</span>
        </button>
        <div class="flex items-center ml-1 pr-2 shrink-0">
          <Button @click.stop="(e: Event) => rowMenu.open(e, { kind: 'chat', id: c.id, userId: c.other?.id, userName: c.other?.name })" icon="pi pi-ellipsis-h" text rounded severity="secondary" class="!w-7 !h-7 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Меню чата" title="Меню чата" />
        </div>
      </div>
    </div>
    <div v-if="tab === 'friends'" class="divide-y dark:divide-zinc-800">
      <div v-if="!friends.length" class="p-6 text-center text-sm text-stone-500">Нет друзей</div>
      <div v-for="f in friends" :key="f.id" class="flex items-center justify-between p-3.5 lg:p-3 select-none active:bg-stone-50 group">
        <Link :href="`/users/${f.other?.id}`" class="flex items-center gap-3 hover:opacity-80 min-w-0">
          <span class="relative shrink-0"><Avatar :image="avatarSrcFor(f.other)" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="isOnline(f.other?.id, (f.other as any)?.last_seen_at)" /></span>
          <span class="text-[15px] lg:text-sm font-medium dark:text-white truncate hover:underline">{{ f.other?.name }}</span>
        </Link>
        <div class="flex gap-1 shrink-0 items-center">
          <button @click="emit('startChat', f.other)" class="text-xs px-3 py-1.5 rounded-full bg-stone-900 dark:bg-white dark:text-zinc-900 text-white font-semibold">Чат</button>
          <Button @click.stop="(e: Event) => rowMenu.open(e, { kind: 'friend', friendship: f, other: f.other, userId: f.other?.id, userName: f.other?.name })" icon="pi pi-ellipsis-h" text rounded severity="secondary" class="!w-7 !h-7 !p-0 !rounded-full shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden" aria-label="Меню" title="Меню" />
        </div>
      </div>
      <InfiniteSentinel :sentinel="friendsSentinel as any" :has-more="!!friendsHasMore" :loading="!!friendsLoadingMore" end-text="Это все друзья" />
    </div>
    <div v-if="tab === 'requests'" class="divide-y dark:divide-zinc-800">
      <div v-if="!pendingIn.length" class="p-6 text-center text-sm text-stone-500">Нет заявок</div>
      <div v-for="r in pendingIn" :key="r.id" class="flex items-center justify-between p-3.5 lg:p-3 gap-2 select-none">
        <Link :href="`/users/${r.requester?.id}`" class="flex items-center gap-3 hover:opacity-80 min-w-0">
          <span class="relative shrink-0"><Avatar :image="avatarSrcFor(r.requester)" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="isOnline(r.requester?.id, (r.requester as any)?.last_seen_at)" /></span>
          <span class="text-[15px] lg:text-sm dark:text-white truncate hover:underline">{{ r.requester?.name }}</span>
        </Link>
        <div class="flex gap-1.5 shrink-0">
          <button @click="emit('accept', r.id)" class="text-xs px-3.5 py-2 rounded-full bg-green-600 text-white font-semibold active:scale-95">Принять</button>
          <button @click="emit('decline', r.id)" class="text-xs px-3 py-2 rounded-full border border-red-200 bg-white text-red-600 dark:bg-zinc-800 dark:border-red-900 dark:text-red-400">Отклонить</button>
        </div>
      </div>
    </div>
    <div v-if="tab === 'blocked'" class="divide-y dark:divide-zinc-800">
      <div v-if="!blocked.length" class="p-6 text-center text-sm text-stone-500">Нет заблокированных</div>
      <div v-for="b in blocked" :key="b.id" class="flex items-center justify-between p-3.5 lg:p-3">
        <div class="flex items-center gap-3 min-w-0"><Avatar :image="avatarSrcFor(b.blocked)" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><span class="text-[15px] lg:text-sm dark:text-white truncate">{{ b.blocked?.name }}</span></div>
        <button v-if="b.blocked?.id" @click="emit('unblock', b.blocked.id)" class="text-xs px-3.5 py-2 rounded-full border bg-white dark:bg-zinc-800 shrink-0">Разблокировать</button>
      </div>
    </div>
    <Menu ref="menuAnchor" :model="(rowMenu.menuModel.value as any)" :popup="true" :pt="menuPt" />
    <Dialog v-model:visible="rowMenu.sheetOpen.value" position="bottom" :draggable="false" :modal="true" :dismissable-mask="true" :show-header="false" :pt="{ root: { class: '!rounded-t-[24px] !rounded-b-none !border-0 !m-0 !max-h-[80dvh] w-full sm:!max-w-[360px]' }, content: { class: '!p-2 !pb-[calc(0.5rem+var(--sab))]' } }">
      <div class="w-10 h-1 rounded-full bg-stone-200 dark:bg-zinc-700 mx-auto my-2.5"></div>
      <div class="px-2 pb-2 space-y-1">
        <div v-if="rowMenu.target.value?.userName" class="px-4 py-2 text-[15px] font-bold truncate dark:text-white">{{ rowMenu.target.value.userName }}</div>
        <button v-for="(it, i) in rowMenu.menuModel.value" :key="i" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-white/5 text-[15px] font-medium text-left dark:text-zinc-100" :class="(it as any).danger ? '!text-red-600' : ''" @click="(it as any).command?.()"><i :class="(it as any).icon"></i>{{ (it as any).label }}</button>
        <button type="button" class="w-full px-4 py-3.5 rounded-2xl bg-stone-100 dark:bg-white/10 dark:text-zinc-100 text-[15px] font-medium mt-1" @click="rowMenu.close()">Отмена</button>
      </div>
    </Dialog>
  </div>
</template>
