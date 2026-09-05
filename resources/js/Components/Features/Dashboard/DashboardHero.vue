<script setup lang="ts">
import Card from 'primevue/card'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Button from 'primevue/button'

defineProps<{ user: any; avatarSrc: string; levelLabel: any; levelColor: any; planLabel: any; planColor: any; sharing: boolean }>()
const emit = defineEmits<{ (e: 'avatar'): void; (e: 'map'): void; (e: 'chat'): void; (e: 'share'): void; (e: 'friends'): void; (e: 'search'): void }>()
</script>
<template>
  <Card class="!bg-stone-900 !text-white !rounded-3xl !shadow-soft !border-0 !overflow-hidden" :pt="{ body: { class: '!p-0' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="p-4 sm:p-8 relative overflow-hidden w-full min-w-0">
        <div class="relative flex flex-col sm:flex-row gap-4 sm:gap-6 min-w-0">
          <button @click="emit('avatar')" class="group relative w-20 h-20 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 border-white/20 shrink-0 self-start bg-white/10">
            <Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:!object-cover" />
            <span class="absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs font-semibold">Просмотр</span>
          </button>
          <div class="min-w-0 flex-1 overflow-hidden">
            <div class="flex flex-wrap items-center gap-2 min-w-0">
              <h1 class="text-[20px] sm:text-[26px] font-black tracking-tight leading-none break-all min-w-0">{{ user.name }}</h1>
              <Tag v-if="user.is_admin || user.role === 'admin'" value="ADMIN" class="!bg-amber-400 !text-stone-900 !border-0 !font-black !text-xs !rounded-full" />
            </div>
            <p class="text-white/60 text-sm mt-2 truncate break-all">{{ user.email }}</p>
            <p class="text-white/40 text-xs mt-1.5 flex flex-wrap items-center gap-2">
              <Tag :value="levelLabel[user.level] || user.level || 'Новичок'" class="!rounded-full !text-xs !font-bold !border" :class="levelColor[user.level || 'novice']" />
              <span class="opacity-80 shrink-0">· {{ user.reputation_score || 0 }} ★</span>
              <Tag :value="planLabel[user.plan || 'free'] || user.plan" class="!rounded-full !text-xs !font-bold !border" :class="planColor[user.plan || 'free']" />
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <Button label="Открыть карту →" rounded class="!bg-white !text-stone-900 !border-white !text-sm !font-bold" @click="emit('map')" />
              <Button rounded class="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !text-white !border-0 !text-sm !font-bold" @click="emit('chat')">Чат</Button>
              <Button icon="pi pi-users" aria-label="Друзья" title="Друзья" rounded outlined class="!bg-white/10 !border-white/30 !text-white hover:!bg-white hover:!text-stone-900 !text-sm !font-bold !w-10 !p-0" @click="emit('friends')" />
              <Button icon="pi pi-search" aria-label="Поиск людей" title="Поиск людей" rounded outlined class="!bg-white/10 !border-white/30 !text-white hover:!bg-white hover:!text-stone-900 !text-sm !font-bold !w-10 !p-0" @click="emit('search')" />
              <Button icon="pi pi-share-alt" label="Поделиться" rounded severity="secondary" outlined class="!bg-white/10 !border-white/30 !text-white hover:!bg-white hover:!text-stone-900 !text-sm !font-bold" :loading="sharing" @click="emit('share')" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
