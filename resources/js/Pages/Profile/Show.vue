<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import { computed, ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useUserProfile } from '@/composables/useUserProfile'

const props = defineProps<{ profileUser: any; isOwn: boolean; friendship: any; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null }>()
const avatarSrc = computed(() => props.profileUser.avatar_path ? `/storage/${props.profileUser.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(props.profileUser.name)}&background=0F172A&color=fff&bold=true`)
const profile = useUserProfile(props.profileUser.id)
const showAvatar = ref(false)
const levelLabel: Record<string,string> = { novice:'Новичок', local:'Местный', guide:'Гид района', explorer:'Исследователь', veteran:'Ветеран' }

const isFriend = ref(props.isFriend)
const isPending = ref(props.isPending)
const isBlocked = ref(!!props.isBlocked)
const isBlockedBy = ref(!!props.isBlockedBy)
const canMessage = ref(props.canMessage)
const reason = ref(props.canMessageReason)
const confirm = ref<{ title:string; msg:string; action:()=>Promise<void>} | null>(null)

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
  <div class="bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 sm:p-8 relative overflow-hidden">
    <div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
    <div class="relative flex flex-col sm:flex-row gap-6">
      <button @click="showAvatar=true" class="group relative w-28 h-28 rounded-[20px] overflow-hidden border-2 border-white/20 shrink-0 bg-white/10">
        <img :src="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-black tracking-tight">{{ profileUser.name }}</h1>
        <p class="text-white/60 text-sm mt-1">{{ levelLabel[profileUser.level] || profileUser.level || 'Новичок' }} · {{ profileUser.reputation_score||0 }} ★ · на сайте с {{ new Date(profileUser.created_at).toLocaleDateString('ru-RU') }}</p>
        <p v-if="profileUser.home_lat" class="text-white/40 text-xs mt-1">Дом: {{ Number(profileUser.home_lat).toFixed(4) }}, {{ Number(profileUser.home_lng).toFixed(4) }} · {{ profileUser.home_radius_km||2 }} км</p>
        <p v-if="!isOwn && isBlockedBy" class="mt-2 text-xs text-red-300 bg-red-900/30 border border-red-800 rounded-xl px-3 py-2">Пользователь заблокировал вас</p>
        <p v-if="!isOwn && isBlocked" class="mt-2 text-xs text-amber-300 bg-amber-900/30 border border-amber-800 rounded-xl px-3 py-2">Вы заблокировали этого пользователя</p>
        <div v-if="!isOwn" class="mt-4 flex flex-wrap gap-2">
          <button @click="onChat" :disabled="(!canMessage && !isBlocked) || profile.loading.value" :title="canMessage ? 'Открыть чат' : (reason||'Закрыто')" class="px-6 py-2.5 rounded-full bg-white text-ink-900 text-sm font-bold hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            {{ canMessage ? 'Написать' : 'Закрыто' }}
          </button>
          <button v-if="!isFriend && !isPending && !isBlocked" @click="onAdd" :disabled="profile.loading.value" title="Отправить заявку в друзья" class="px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/15 flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            В друзья
          </button>
          <span v-else-if="isPending" class="px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Заявка отправлена
          </span>
          <span v-else-if="isFriend" class="px-6 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            Друзья
          </span>
          <button v-if="isFriend" @click="confirm={title:'Удалить из друзей?', msg:`Удалить ${profileUser.name} из друзей?`, action: onRemove}" :disabled="profile.loading.value" class="px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/15 flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM6 14a6 6 0 00-6 6h12a6 6 0 00-6-6z"/><path stroke-linecap="round" d="M16 11h5"/></svg>
            Удалить из друзей
          </button>
          <button v-if="!isBlocked" @click="confirm={title:'Заблокировать?', msg:`Заблокировать ${profileUser.name}? Чат и дружба будут удалены.`, action: onBlock}" :disabled="profile.loading.value" class="px-6 py-2.5 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M4.93 4.93l14.14 14.14"/></svg>
            Заблокировать
          </button>
          <button v-else @click="onUnblock" :disabled="profile.loading.value" class="px-6 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Разблокировать
          </button>
        </div>
        <p v-if="!isOwn && !canMessage && !isBlocked && !isBlockedBy" class="mt-3 text-xs text-red-300 bg-red-900/30 border border-red-800 rounded-xl px-3 py-2">{{ reason }} — добавьте в друзья</p>
      </div>
    </div>
  </div>

  <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
    <h3 class="font-black">Информация</h3>
    <div class="mt-4 space-y-3 text-sm">
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Имя</span><span class="font-semibold dark:text-white">{{ profileUser.name }}</span></div>
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Уровень</span><span class="font-semibold dark:text-white">{{ levelLabel[profileUser.level] || profileUser.level }}</span></div>
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Репутация</span><span class="font-semibold dark:text-white">{{ profileUser.reputation_score||0 }}</span></div>
      <div class="flex justify-between py-2.5"><span class="text-stone-500">Дата регистрации</span><span class="font-semibold dark:text-white">{{ new Date(profileUser.created_at).toLocaleDateString('ru-RU') }}</span></div>
    </div>
    <div class="mt-6 flex gap-2">
      <Link href="/map" class="flex-1 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full py-2.5 text-sm font-bold text-center">На карту →</Link>
      <Link href="/chat" class="flex-1 bg-white border border-stone-200 rounded-full py-2.5 text-sm font-bold text-center">Чаты</Link>
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
