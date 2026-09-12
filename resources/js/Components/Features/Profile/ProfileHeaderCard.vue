<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Message from 'primevue/message'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import ProfileMoreMenu from '@/Components/Features/Profile/ProfileMoreMenu.vue'
import UserSubscribeButton from '@/Components/Features/Profile/UserSubscribeButton.vue'

defineProps<{ user: any; avatarSrc: string; online: boolean; lastSeen: string; levelName: string; isOwn: boolean; isLocked: boolean; canMessage: boolean; isBlocked: boolean; isFriend: boolean; isPending: boolean; loading: boolean; sharing: boolean; subscription?: { subscribed: boolean; notify_pin: boolean; notify_photo: boolean; notify_level: boolean; notify_post?: boolean } }>()
const emit = defineEmits<{ (e: 'avatar'): void; (e: 'chat'): void; (e: 'add'): void; (e: 'remove'): void; (e: 'block'): void; (e: 'unblock'): void; (e: 'share'): void; (e: 'friends'): void; (e: 'search'): void; (e: 'gallery'): void }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div v-if="isLocked" class="flex flex-col items-center text-center gap-3 py-3">
        <button @click="emit('avatar')" class="w-16 h-16 rounded-3xl overflow-hidden border bg-stone-50"><Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:object-cover" /></button>
        <Message severity="error" :closable="false" class="max-w-[420px] !rounded-2xl"><span class="font-bold">⛔ Пользователь заблокировал вас</span></Message>
        <p class="text-stone-500 text-sm max-w-[420px]">Профиль скрыт.</p>
        <Link href="/map"><Button label="На карту →" rounded class="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !text-sm !font-bold !shadow-glow" /></Link>
      </div>
      <div v-else>
        <div class="flex items-center gap-4">
          <span class="block h-16 w-16 shrink-0 sm:h-20 sm:w-20">
            <button @click="emit('avatar')" class="relative block h-full w-full overflow-hidden rounded-3xl border bg-stone-50">
              <Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:object-cover" />
              <OnlineDot :online="online" size="w-4 h-4" />
            </button>
          </span>
          <div class="min-w-0 flex-1">
            <h1 class="text-lg sm:text-xl font-black tracking-tight truncate flex items-center gap-2">{{ user.name }}</h1>
            <p class="text-[13px] sm:text-sm flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0" :class="online ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'"><span class="whitespace-nowrap">{{ online ? 'в сети' : lastSeen }}</span><span aria-hidden="true" class="text-stone-300 dark:text-zinc-600 shrink-0">·</span><span class="whitespace-nowrap">{{ levelName }} · {{ user.reputation_score || 0 }} ★</span></p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <Button @click="emit('gallery')" rounded text class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-images" aria-label="Галерея" title="Галерея" />
            <Button @click="emit('friends')" rounded text class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-users" aria-label="Друзья" title="Друзья" />
            <Button v-if="isOwn" @click="emit('search')" rounded text class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-search" aria-label="Поиск людей" title="Поиск людей" />
            <ProfileMoreMenu v-else-if="!isLocked && !isBlocked" :user-id="(user as any).id" :user-name="(user as any).name" button-class="!w-10 !h-10 !p-0 !rounded-full" @share="emit('share')" @block="emit('block')" @remove="emit('remove')" />
            <Link href="/map" class="hidden sm:inline-flex"><Button label="На карту →" rounded class="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !text-sm !font-bold !shadow-glow hover:!opacity-90" /></Link>
          </div>
        </div>
        <div v-if="!isOwn && !isLocked" class="mt-4 flex items-center gap-2 rounded-2xl p-2.5 bg-gradient-to-br from-stone-100/90 to-stone-50/50 dark:from-white/[0.07] dark:to-white/[0.02] border border-stone-200/60 dark:border-white/10">
          <Button v-if="canMessage && !isBlocked" @click="emit('chat')" :loading="loading" rounded class="!w-10 !h-10 !p-0 !rounded-full !bg-gradient-to-br !from-brand-500 !to-violet-600 !border-0 !text-white !shadow-glow" icon="pi pi-comments" aria-label="Написать" />
          <Button v-if="!isFriend && !isPending && !isBlocked" @click="emit('add')" :loading="loading" rounded severity="secondary" outlined class="!w-10 !h-10 !p-0 !rounded-full dark:!bg-white/5 dark:!border-white/15 dark:!text-zinc-100 dark:hover:!bg-white/10" icon="pi pi-user-plus" aria-label="Добавить в друзья" />
          <Button v-if="isFriend" @click="emit('remove')" rounded severity="danger" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-user-minus" aria-label="Удалить из друзей" />
          <Button v-if="!isBlocked" @click="emit('block')" rounded severity="danger" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-ban" aria-label="Заблокировать" />
          <Button v-else @click="emit('unblock')" :loading="loading" rounded severity="danger" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-ban" aria-label="Разблокировать" />
          <UserSubscribeButton v-if="!isBlocked && isFriend" :user-id="(user as any).id" :initial="subscription" :compact="true" :is-friend="isFriend" />
          <span class="ml-1 text-xs font-medium text-stone-500 dark:text-zinc-400 hidden sm:inline">Действия</span>
        </div>
        <div class="mt-3 flex gap-2 rounded-2xl p-2.5 bg-gradient-to-br from-stone-100/90 to-stone-50/50 dark:from-white/[0.07] dark:to-white/[0.02] border border-stone-200/60 dark:border-white/10">
          <Button icon="pi pi-share-alt" label="Поделиться профилем" severity="secondary" outlined rounded class="!rounded-full !text-[13px] sm:!text-sm !font-semibold flex-1 min-w-0 !px-3 dark:!bg-white/5 dark:!border-white/15 dark:!text-zinc-100 dark:hover:!bg-white/10 [&_.p-button-label]:truncate" :loading="sharing" @click="emit('share')" />
          <Link href="/map" class="sm:hidden flex-1 min-w-0"><Button label="На карту →" rounded class="w-full !bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !text-[13px] sm:!text-sm !font-bold !px-3 !shadow-glow [&_.p-button-label]:whitespace-nowrap" /></Link>
        </div>
      </div>
    </template>
  </Card>
</template>
