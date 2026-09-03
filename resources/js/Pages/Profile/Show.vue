<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import { computed, ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Card from 'primevue/card'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import OnlineDot from '@/Components/OnlineDot.vue'
import { usePresenceState } from '@/composables/usePresence'
import { useUserProfile } from '@/composables/useUserProfile'
import { avatarSrcFor } from '@/composables/useAvatar'
const props = defineProps<{ profileUser: any; isOwn: boolean; friendship: any; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null }>()
const avatarSrc = computed(() => avatarSrcFor(props.profileUser))
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
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-4 sm:!p-5' }, content:{ class:'!p-0' } }">
    <template #content>
      <div v-if="isLocked" class="flex flex-col items-center text-center gap-3 py-3">
        <button @click="showAvatar=true" class="group relative w-16 h-16 rounded-3xl overflow-hidden border border-stone-200 dark:border-zinc-700 shrink-0 bg-stone-50">
          <Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:object-cover" />
        </button>
        <Message severity="error" :closable="false" class="justify-center max-w-[420px] !bg-red-50 !border-red-200 !text-red-700 dark:!bg-red-950/30 dark:!border-red-900 dark:!text-red-300 !rounded-2xl"><span class="font-bold">⛔ Пользователь заблокировал вас</span></Message>
        <p class="text-stone-500 dark:text-zinc-400 text-sm max-w-[420px]">Профиль скрыт.</p>
        <Link href="/map"><Button label="На карту →" rounded class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !border-ink-900 dark:!border-white !text-sm !font-bold !px-5 !py-2" /></Link>
      </div>
      <div v-else>
        <div class="flex items-center gap-4">
          <button @click="showAvatar=true" class="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden border border-stone-200 dark:border-zinc-700 shrink-0 bg-stone-50 dark:bg-zinc-800">
            <Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:object-cover" />
            <OnlineDot :online="online" size="w-4 h-4" />
          </button>
          <div class="min-w-0 flex-1">
            <h1 class="text-lg sm:text-xl font-black tracking-tight truncate text-ink-900 dark:text-white flex items-center gap-2">{{ profileUser.name }}<span v-if="online" class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0"></span></h1>
            <p class="text-sm truncate flex items-center gap-1.5" :class="online ? 'text-emerald-600' : 'text-stone-500 dark:text-zinc-400'">{{ online ? '● в сети' : '○ офлайн' }}<span class="text-stone-300">·</span>{{ levelLabel[profileUser.level] || profileUser.level || 'Новичок' }} · {{ profileUser.reputation_score||0 }} ★</p>
          </div>
          <Link href="/map" class="hidden sm:inline-flex"><Button label="На карту →" rounded class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !border-ink-900 dark:!border-white !text-sm !font-bold !px-5 !py-2.5" /></Link>
        </div>
        <div v-if="!isOwn && !isLocked" class="mt-4 flex items-center gap-2">
          <Button v-if="canMessage && !isBlocked && !isBlockedBy" @click="onChat" :loading="profile.loading.value" rounded class="!w-10 !h-10 !p-0 !rounded-full !bg-stone-900 dark:!bg-white !text-white dark:!text-zinc-900 !border-stone-900 dark:!border-white" icon="pi pi-comments" aria-label="Написать" />
          <Button v-if="!isFriend && !isPending && !isBlocked" @click="onAdd" :loading="profile.loading.value" rounded severity="secondary" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-user-plus" aria-label="Добавить в друзья" />
          <Tag v-if="isPending" value="⋯" class="!w-10 !h-10 !rounded-full !bg-amber-100 dark:!bg-amber-900/30 !text-amber-600 !border-0 !justify-center !text-xs !font-bold" />
          <Button v-if="isFriend" @click="confirm={title:'Удалить из друзей?', msg:`Удалить ${profileUser.name} из друзей?`, action:onRemove}" rounded severity="secondary" outlined class="!w-10 !h-10 !p-0 !rounded-full hover:!text-red-600 hover:!border-red-200 hover:!bg-red-50" icon="pi pi-user-minus" aria-label="Удалить из друзей" />
          <Button v-if="!isBlocked" @click="confirm={title:'Заблокировать?', msg:`Заблокировать ${profileUser.name}?`, action:onBlock}" rounded severity="secondary" outlined class="!w-10 !h-10 !p-0 !rounded-full hover:!text-red-600 hover:!border-red-200 hover:!bg-red-50" icon="pi pi-ban" aria-label="Заблокировать" />
          <Button v-else @click="onUnblock" :loading="profile.loading.value" rounded severity="danger" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-ban" aria-label="Разблокировать" />
        </div>
        <Link href="/map" class="sm:hidden mt-4 flex w-full"><Button label="На карту →" rounded class="w-full !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !border-ink-900 dark:!border-white !justify-center !text-sm !font-bold" /></Link>
      </div>
    </template>
  </Card>
  <Card v-if="!isLocked" class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-6' }, content:{ class:'!p-0' } }">
    <template #content>
      <h3 class="font-black dark:text-white">Основная информация</h3>
      <Card class="!bg-stone-50/70 dark:!bg-zinc-800/50 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-none mt-4" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }">
        <template #content>
          <div class="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-stone-400">О себе</div>
          <div v-if="!bioEmpty" class="mt-2 text-sm leading-relaxed text-stone-800 dark:text-zinc-200 whitespace-pre-wrap break-words">{{ bioText }}</div>
          <div v-else class="mt-2 text-sm text-stone-500 dark:text-zinc-400">Пользователь пока ничего не рассказал о себе.</div>
        </template>
      </Card>
      <div class="mt-4 space-y-3 text-sm">
        <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Имя</span><Tag :value="profileUser.name" class="!bg-stone-100 dark:!bg-zinc-800 !text-ink-900 dark:!text-white !border-0 !font-semibold" /></div>
        <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Уровень</span><Tag :value="levelLabel[profileUser.level] || profileUser.level" class="!bg-ink-900 !text-white !border-0 !font-semibold !rounded-full" /></div>
        <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Репутация</span><span class="font-semibold dark:text-white">{{ profileUser.reputation_score||0 }}</span></div>
        <div class="flex justify-between py-2.5"><span class="text-stone-500">Дата регистрации</span><span class="font-semibold dark:text-white">{{ new Date(profileUser.created_at).toLocaleDateString('ru-RU') }}</span></div>
      </div>
      <div class="mt-6">
        <Link href="/map" class="flex w-full"><Button label="На карту →" rounded class="w-full !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !border-ink-900 dark:!border-white !justify-center" /></Link>
      </div>
    </template>
  </Card>
  <div v-if="showAvatar" @click="showAvatar=false" class="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out">
    <Avatar :image="avatarSrc" shape="square" class="!w-auto !h-auto max-w-full max-h-[85vh] !rounded-3xl [&_img]:!rounded-3xl [&_img]:max-h-[85vh] [&_img]:object-contain" />
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
