<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import { computed, ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import OnlineDot from '@/Components/OnlineDot.vue'
import { usePresenceState } from '@/composables/usePresence'
import { useUserProfile } from '@/composables/useUserProfile'
const props = defineProps<{ profileUser: any; isOwn: boolean; friendship: any; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null }>()
const avatarSrc = computed(() => props.profileUser.avatar_path ? `/storage/${props.profileUser.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(props.profileUser.name)}&background=0F172A&color=fff&bold=true`)
const profile = useUserProfile(props.profileUser.id)
const showAvatar = ref(false)
const bioText = computed(() => (props.profileUser.bio || '').trim())
const bioEmpty = computed(() => bioText.value.length === 0)
const levelLabel: Record<string,string> = { novice:'Новичок', local:'Местный', guide:'Гид района', explorer:'Исследователь', veteran:'Ветеран' }

const isFriend = ref(props.isFriend)
const isPending = ref(props.isPending)
const isBlocked = ref(!!props.isBlocked)
const isBlockedBy = ref(!!props.isBlockedBy)
const canMessage = ref(props.canMessage)
const reason = ref(props.canMessageReason)
const confirm = ref<{ title:string; msg:string; action:()=>Promise<void>} | null>(null)
const isLocked = computed(() => isBlockedBy.value)
const { isOnline } = usePresenceState()
const online = computed(() => isOnline(props.profileUser.id))

async function sync() {
  isFriend.value = profile.isFriend.value
  isPending.value = profile.isPending.value
  isBlocked.value = profile.isBlocked.value
  isBlockedBy.value = profile.isBlockedBy.value
  canMessage.value = profile.canMessage.value
  reason.value = profile.reason.value
}
async function onAdd() { await profile.addFriend(); await sync() }
async function onRemove() { await profile.removeFriend(); await sync() }
async function onBlock() { await profile.block(); await sync() }
async function onUnblock() { await profile.unblock(); await sync() }
async function onChat() { await profile.startChat() }
</script>

<template>
<Head :title="profileUser.name" />
<AuthenticatedLayout>
<div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
<div class="max-w-[860px] mx-auto px-4 sm:px-6 py-6 space-y-5">
  <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-4 sm:p-5 shadow-soft">
    <div v-if="isLocked" class="flex flex-col items-center text-center gap-3 py-3">
      <button @click="showAvatar=true" class="group relative w-16 h-16 rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 shrink-0 bg-stone-50">
        <img :src="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition" />
      </button>
      <Message severity="error" :closable="false" class="justify-center max-w-[420px] !bg-red-50 !border-red-200 !text-red-700 dark:!bg-red-950/30 dark:!border-red-900 dark:!text-red-300">
        <span class="font-bold">⛔ Пользователь заблокировал вас</span>
      </Message>
      <p class="text-stone-500 dark:text-zinc-400 text-sm max-w-[420px]">Профиль скрыт.</p>
      <Link href="/map" class="mt-1 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-5 py-2 text-sm font-bold">На карту →</Link>
    </div>
    <div v-else>
      <div class="flex items-center gap-4">
        <button @click="showAvatar=true" class="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 shrink-0 bg-stone-50 dark:bg-zinc-800">
          <img :src="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition" />
          <OnlineDot :online="online" size="w-4 h-4" />
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="text-lg sm:text-xl font-black tracking-tight truncate text-ink-900 dark:text-white flex items-center gap-2">{{ profileUser.name }}<span v-if="online" class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></span></h1>
          <p class="text-sm truncate flex items-center gap-1.5" :class="online ? 'text-emerald-600' : 'text-stone-500 dark:text-zinc-400'">{{ online ? '● в сети' : '○ офлайн' }}<span class="text-stone-300">·</span>{{ levelLabel[profileUser.level] || profileUser.level || 'Новичок' }} · {{ profileUser.reputation_score||0 }} ★</p>
        </div>
        <Link href="/map" class="hidden sm:inline-flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-5 py-2.5 text-sm font-bold hover:opacity-90 transition shrink-0">На карту →</Link>
      </div>
      <div v-if="!isOwn && !isLocked" class="mt-4 flex items-center gap-2">
        <button v-if="canMessage && !isBlocked && !isBlockedBy" @click="onChat" :disabled="profile.loading.value" title="Написать" class="w-10 h-10 grid place-items-center rounded-full bg-stone-900 dark:bg-white text-white dark:text-zinc-900 active:scale-95 disabled:opacity-40 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        </button>
        <button v-if="!isFriend && !isPending && !isBlocked" @click="onAdd" :disabled="profile.loading.value" title="Добавить в друзья" class="w-10 h-10 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-violet-50 text-stone-500 hover:text-violet-600 active:scale-95 transition disabled:opacity-40">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        </button>
        <span v-if="isPending" title="Заявка отправлена" class="w-10 h-10 grid place-items-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 text-xs font-bold">⋯</span>
        <button v-if="isFriend" @click="confirm={title:'Удалить из друзей?', msg:`Удалить ${profileUser.name} из друзей?`, action:onRemove}" title="Удалить из друзей" class="w-10 h-10 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 active:scale-95 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM6 14a6 6 0 00-6 6h12a6 6 0 00-6-6z"/><path stroke-linecap="round" d="M16 11h5M21 11h-5"/></svg>
        </button>
        <button v-if="!isBlocked" @click="confirm={title:'Заблокировать?', msg:`Заблокировать ${profileUser.name}?`, action:onBlock}" title="Заблокировать" class="w-10 h-10 grid place-items-center rounded-full bg-stone-100 dark:bg-zinc-800 hover:bg-red-50 text-stone-500 hover:text-red-600 active:scale-95 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
        </button>
        <button v-else @click="onUnblock" :disabled="profile.loading.value" title="Разблокировать" class="w-10 h-10 grid place-items-center rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 active:scale-95 transition disabled:opacity-40">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14" opacity="0.3"/></svg>
        </button>
      </div>
      <Link href="/map" class="sm:hidden mt-4 flex w-full bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full py-2.5 text-sm font-bold justify-center hover:opacity-90 transition">На карту →</Link>
    </div>
  </div>

  <div v-if="!isLocked" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
    <h3 class="font-black">Основная информация</h3>
    <div class="mt-4 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-800/50 p-4">
      <div class="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-stone-400">О себе</div>
      <div v-if="!bioEmpty" class="mt-2 text-sm leading-relaxed text-stone-800 dark:text-zinc-200 whitespace-pre-wrap break-words">{{ bioText }}</div>
      <div v-else class="mt-2 text-sm text-stone-500 dark:text-zinc-400">Пользователь пока ничего не рассказал о себе.</div>
    </div>
    <div class="mt-4 space-y-3 text-sm">
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Имя</span><span class="font-semibold dark:text-white">{{ profileUser.name }}</span></div>
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Уровень</span><span class="font-semibold dark:text-white">{{ levelLabel[profileUser.level] || profileUser.level }}</span></div>
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Репутация</span><span class="font-semibold dark:text-white">{{ profileUser.reputation_score||0 }}</span></div>
      <div class="flex justify-between py-2.5"><span class="text-stone-500">Дата регистрации</span><span class="font-semibold dark:text-white">{{ new Date(profileUser.created_at).toLocaleDateString('ru-RU') }}</span></div>
    </div>
    <div class="mt-6">
      <Link href="/map" class="flex w-full bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full py-2.5 text-sm font-bold text-center justify-center">На карту →</Link>
    </div>
  </div>

  <div v-if="showAvatar" @click="showAvatar=false" class="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out">
    <img :src="avatarSrc" class="max-w-full max-h-[85vh] rounded-2xl object-contain" />
  </div>
</div>
</div>
<Dialog :visible="!!confirm" @update:visible="(v:boolean)=>{ if(!v) confirm=null }" modal :closable="true" :draggable="false" :style="{width:'360px', maxWidth:'calc(100vw - 2rem)'}">
  <template #header><span class="font-bold">{{ confirm?.title }}</span></template>
  <p class="text-sm text-stone-600 dark:text-zinc-300">{{ confirm?.msg }}</p>
  <template #footer>
    <div class="flex justify-end gap-2">
      <Button label="Отмена" severity="secondary" text @click="confirm=null" />
      <Button label="Подтвердить" severity="danger" @click="async()=>{ const a=confirm!.action; confirm=null; await a() }" />
    </div>
  </template>
</Dialog>
</AuthenticatedLayout>
</template>
