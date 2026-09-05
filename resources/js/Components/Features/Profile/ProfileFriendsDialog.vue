<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { avatarSrcFor } from '@/composables/useAvatar'

defineProps<{ people: any }>()
</script>
<template>
  <Dialog :visible="people.friendsOpen.value" @update:visible="(v:boolean)=>{ if(!v) people.closeFriends() }" modal :dismissableMask="true" :closable="true" :header="people.friendsTitle.value ? `Друзья · ${people.friendsTitle.value}` : 'Друзья'" :style="{ width: '440px', maxWidth: '94vw' }" :pt="{ content: { class: '!p-4' } }">
    <div v-if="people.friendsLoading.value" class="py-8 text-center text-sm text-stone-400">Загружаем друзей…</div>
    <div v-else-if="!people.friends.value.length" class="py-8 text-center text-sm text-stone-400">Пока пусто</div>
    <div v-else class="max-h-[60dvh] overflow-y-auto -mx-1 px-1">
      <button v-for="f in people.friends.value" :key="f.id" type="button" @click="people.goProfile(f.other.id)" class="w-full min-h-[60px] flex items-center gap-3 px-2 py-1.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-white/5 active:scale-[0.99] transition text-left overflow-hidden">
        <img :src="avatarSrcFor(f.other) || undefined" class="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
        <span class="min-w-0 flex-1"><span class="block text-sm font-bold truncate dark:text-zinc-100">{{ f.other.name }}</span></span>
        <i class="pi pi-chevron-right text-xs text-stone-300 dark:text-zinc-600 shrink-0"></i>
      </button>
    </div>
  </Dialog>
</template>
