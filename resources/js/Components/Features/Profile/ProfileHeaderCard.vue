<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Message from 'primevue/message'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'

defineProps<{ user: any; avatarSrc: string; online: boolean; lastSeen: string; levelName: string; isOwn: boolean; isLocked: boolean; canMessage: boolean; isBlocked: boolean; isFriend: boolean; isPending: boolean; loading: boolean; sharing: boolean }>()
const emit = defineEmits<{ (e: 'avatar'): void; (e: 'chat'): void; (e: 'add'): void; (e: 'remove'): void; (e: 'block'): void; (e: 'unblock'): void; (e: 'share'): void }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div v-if="isLocked" class="flex flex-col items-center text-center gap-3 py-3">
        <button @click="emit('avatar')" class="w-16 h-16 rounded-3xl overflow-hidden border bg-stone-50"><Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:object-cover" /></button>
        <Message severity="error" :closable="false" class="max-w-[420px] !rounded-2xl"><span class="font-bold">⛔ Пользователь заблокировал вас</span></Message>
        <p class="text-stone-500 text-sm max-w-[420px]">Профиль скрыт.</p>
        <Link href="/map"><Button label="На карту →" rounded class="!bg-stone-900 !text-white !text-sm !font-bold" /></Link>
      </div>
      <div v-else>
        <div class="flex items-center gap-4">
          <button @click="emit('avatar')" class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden border shrink-0 bg-stone-50">
            <Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:object-cover" />
            <OnlineDot :online="online" size="w-4 h-4" />
          </button>
          <div class="min-w-0 flex-1">
            <h1 class="text-lg sm:text-xl font-black tracking-tight truncate flex items-center gap-2">{{ user.name }}</h1>
            <p class="text-sm truncate flex items-center gap-1.5" :class="online ? 'text-emerald-600' : 'text-red-500'">{{ online ? 'в сети' : lastSeen }}<span class="text-stone-300">·</span>{{ levelName }} · {{ user.reputation_score || 0 }} ★</p>
          </div>
          <Link href="/map" class="hidden sm:inline-flex"><Button label="На карту →" rounded class="!bg-stone-900 !text-white !text-sm !font-bold" /></Link>
        </div>
        <div v-if="!isOwn && !isLocked" class="mt-4 flex items-center gap-2">
          <Button v-if="canMessage && !isBlocked" @click="emit('chat')" :loading="loading" rounded class="!w-10 !h-10 !p-0 !rounded-full !bg-stone-900 !text-white" icon="pi pi-comments" aria-label="Написать" />
          <Button v-if="!isFriend && !isPending && !isBlocked" @click="emit('add')" :loading="loading" rounded severity="secondary" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-user-plus" aria-label="Добавить в друзья" />
          <Button v-if="isFriend" @click="emit('remove')" rounded severity="secondary" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-user-minus" aria-label="Удалить из друзей" />
          <Button v-if="!isBlocked" @click="emit('block')" rounded severity="secondary" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-ban" aria-label="Заблокировать" />
          <Button v-else @click="emit('unblock')" :loading="loading" rounded severity="danger" outlined class="!w-10 !h-10 !p-0 !rounded-full" icon="pi pi-ban" aria-label="Разблокировать" />
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <Button icon="pi pi-share-alt" label="Поделиться профилем" severity="secondary" outlined rounded class="!rounded-full !text-sm !font-semibold" :loading="sharing" @click="emit('share')" />
          <Link href="/map" class="sm:hidden flex-1"><Button label="На карту →" rounded class="w-full !bg-stone-900 !text-white !text-sm !font-bold" /></Link>
        </div>
      </div>
    </template>
  </Card>
</template>
