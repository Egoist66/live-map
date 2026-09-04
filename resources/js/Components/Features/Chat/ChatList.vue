<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import { avatarSrcFor } from '@/composables/useAvatar'

defineProps<{ conversations: any[]; friends: any[]; pendingIn: any[]; blocked: any[]; tab: string; selectedId: number | null; filter: string; isOnline: (id?: number) => boolean; formatTime: (s: string) => string }>()
const emit = defineEmits<{ (e: 'update:filter', v: string): void; (e: 'open', id: number): void; (e: 'startChat', u: any): void; (e: 'deleteChat', id: number): void; (e: 'block', id: number, name?: string): void; (e: 'unblock', id: number): void; (e: 'removeFriend', f: any): void; (e: 'accept', id: number): void; (e: 'decline', id: number): void; (e: 'sheet', p: any): void }>()
</script>
<template>
  <div class="flex-1 overflow-auto overscroll-contain min-h-0 w-full max-w-full">
    <div class="p-2.5 border-b dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
      <div class="relative w-full">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none" />
        <input :value="filter" @input="emit('update:filter', ($event.target as HTMLInputElement).value)" placeholder="Поиск по чатам — имя фамилия..." class="w-full rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        <i v-if="filter" class="pi pi-times absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm cursor-pointer" @click="emit('update:filter', '')" />
      </div>
    </div>
    <div v-if="tab === 'chats'" class="divide-y dark:divide-zinc-800">
      <div v-if="!conversations.length" class="p-10 lg:p-8 text-center">
        <div class="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-zinc-800 grid place-items-center mx-auto mb-3 text-xl">💬</div>
        <div class="text-sm font-semibold dark:text-white">Нет чатов</div>
        <div class="text-xs text-stone-500 mt-1">Найдите человека через поиск выше</div>
      </div>
      <div v-for="c in conversations" :key="c.id" class="group w-full flex items-center gap-0 text-left select-none">
        <button @click="emit('open', c.id)" :class="selectedId === c.id ? 'bg-stone-50 dark:bg-zinc-800' : ''" class="flex-1 flex items-center gap-3 p-3.5 lg:p-3 text-left min-w-0 hover:bg-stone-50/70 dark:hover:bg-zinc-800/70 transition-colors">
          <span class="relative shrink-0">
            <Avatar :image="avatarSrcFor(c.other)" shape="circle" size="large" class="!w-11 !h-11 [&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" />
            <OnlineDot :online="isOnline(c.other?.id)" />
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline gap-2"><span class="text-[15px] lg:text-sm font-semibold dark:text-white truncate">{{ c.other?.name || 'Чат' }}</span><span v-if="c.last_message_at" class="text-[11px] text-stone-400 shrink-0">{{ formatTime(c.last_message_at) }}</span></div>
            <div class="text-[13px] lg:text-xs truncate flex items-center gap-1 mt-0.5" :class="isOnline(c.other?.id) ? 'text-emerald-600' : 'text-red-500'">{{ isOnline(c.other?.id) ? 'в сети' : 'офлайн' }}<span class="text-stone-300">·</span><span class="truncate text-stone-500">{{ c.last_message?.body || 'Нет сообщений' }}</span><span v-if="(c.last_message as any)?.is_edited" class="text-[10px] text-stone-400">(изм.)</span></div>
          </div>
          <span v-if="c.unread_count" class="bg-violet-600 text-white text-xs font-bold min-w-[22px] h-[22px] grid place-items-center px-1.5 rounded-full shrink-0">{{ c.unread_count > 9 ? '9+' : c.unread_count }}</span>
        </button>
        <div class="flex items-center gap-1 pr-2 shrink-0">
          <button @click.stop="emit('deleteChat', c.id)" title="Удалить чат" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 transition">✕</button>
          <button v-if="c.other?.id" @click.stop="emit('block', c.other.id, c.other.name)" title="Заблокировать" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 transition">⊘</button>
        </div>
      </div>
    </div>
    <div v-if="tab === 'friends'" class="divide-y dark:divide-zinc-800">
      <div v-if="!friends.length" class="p-10 text-center text-sm text-stone-500">Нет друзей</div>
      <div v-for="f in friends" :key="f.id" class="flex items-center justify-between p-3.5 lg:p-3 select-none active:bg-stone-50 group">
        <Link :href="`/users/${f.other?.id}`" class="flex items-center gap-3 hover:opacity-80 min-w-0">
          <span class="relative shrink-0"><Avatar :image="avatarSrcFor(f.other)" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="isOnline(f.other?.id)" /></span>
          <span class="text-[15px] lg:text-sm font-medium dark:text-white truncate hover:underline">{{ f.other?.name }}</span>
        </Link>
        <div class="flex gap-1 shrink-0 items-center">
          <button @click="emit('startChat', f.other)" class="text-xs px-3 py-1.5 rounded-full bg-stone-900 dark:bg-white dark:text-zinc-900 text-white font-semibold">Чат</button>
          <button @click.stop="emit('removeFriend', f)" title="Удалить из друзей" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 transition">✕</button>
          <button v-if="f.other?.id" @click.stop="emit('block', f.other.id, f.other.name)" title="Заблокировать" class="w-7 h-7 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 transition">⊘</button>
        </div>
      </div>
    </div>
    <div v-if="tab === 'requests'" class="divide-y dark:divide-zinc-800">
      <div v-if="!pendingIn.length" class="p-10 text-center text-sm text-stone-500">Нет заявок</div>
      <div v-for="r in pendingIn" :key="r.id" class="flex items-center justify-between p-3.5 lg:p-3 gap-2 select-none">
        <Link :href="`/users/${r.requester?.id}`" class="flex items-center gap-3 hover:opacity-80 min-w-0">
          <span class="relative shrink-0"><Avatar :image="avatarSrcFor(r.requester)" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><OnlineDot :online="isOnline(r.requester?.id)" /></span>
          <span class="text-[15px] lg:text-sm dark:text-white truncate hover:underline">{{ r.requester?.name }}</span>
        </Link>
        <div class="flex gap-1.5 shrink-0">
          <button @click="emit('accept', r.id)" class="text-xs px-3.5 py-2 rounded-full bg-green-600 text-white font-semibold active:scale-95">Принять</button>
          <button @click="emit('decline', r.id)" class="text-xs px-3 py-2 rounded-full border bg-white dark:bg-zinc-800">Отклонить</button>
        </div>
      </div>
    </div>
    <div v-if="tab === 'blocked'" class="divide-y dark:divide-zinc-800">
      <div v-if="!blocked.length" class="p-10 text-center text-sm text-stone-500">Нет заблокированных</div>
      <div v-for="b in blocked" :key="b.id" class="flex items-center justify-between p-3.5 lg:p-3">
        <div class="flex items-center gap-3 min-w-0"><Avatar :image="avatarSrcFor(b.blocked)" shape="circle" class="[&_img]:object-cover" :pt="{ image: { class: 'object-cover' } }" /><span class="text-[15px] lg:text-sm dark:text-white truncate">{{ b.blocked?.name }}</span></div>
        <button v-if="b.blocked?.id" @click="emit('unblock', b.blocked.id)" class="text-xs px-3.5 py-2 rounded-full border bg-white dark:bg-zinc-800 shrink-0">Разблокировать</button>
      </div>
    </div>
  </div>
</template>
