<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Dialog from 'primevue/dialog'
import Avatar from 'primevue/avatar'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import { avatarSrcFor } from '@/composables/useAvatar'

defineProps<{ open: boolean; query: string; results: any[]; searching: boolean; creating: boolean; isOnline: (id?: number) => boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'update:query', v: string): void; (e: 'chat', u: any): void; (e: 'add', id: number): void; (e: 'block', id: number, name?: string): void }>()
</script>
<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" modal header="Поиск людей" :style="{ width: '480px', maxWidth: '96vw', maxHeight: '92dvh' }" :pt="{ content: { class: '!pt-2 !max-h-[80dvh] !overflow-y-auto' } }">
    <div class="text-xs text-stone-500 mb-3">Найди человека по имени чтобы начать чат — отдельный глобальный поиск</div>
    <div class="relative w-full">
      <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
      <input :value="query" @input="emit('update:query', ($event.target as HTMLInputElement).value)" placeholder="Имя, например Петр..." autofocus class="w-full rounded-full border border-stone-200 pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      <i v-if="searching" class="pi pi-spin pi-spinner absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
    </div>
    <div v-if="results.length" class="mt-3 max-h-[60dvh] sm:max-h-[52vh] overflow-auto divide-y border rounded-2xl bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-sm">
      <div v-for="u in results" :key="u.id" class="flex items-center justify-between p-3 select-none">
        <Link :href="`/users/${u.id}`" class="flex items-center gap-2.5 min-w-0">
          <span class="relative shrink-0"><Avatar :image="avatarSrcFor(u)" shape="circle" size="normal" class="!w-9 !h-9 [&_img]:object-cover" /><OnlineDot :online="isOnline(u.id)" size="w-3 h-3" /></span>
          <div class="min-w-0"><div class="text-sm font-medium truncate">{{ u.name }}</div></div>
        </Link>
        <div class="flex gap-1 shrink-0 ml-2 items-center">
          <button v-if="u.can_message !== false" @click="emit('chat', u)" :disabled="creating" title="Написать" class="w-8 h-8 grid place-items-center rounded-full bg-stone-900 text-white disabled:opacity-40">✉</button>
          <button @click.stop="emit('add', u.id)" title="В друзья" class="w-8 h-8 grid place-items-center rounded-full bg-stone-100 text-stone-500">+</button>
          <button @click.stop="emit('block', u.id, u.name)" title="Заблокировать" class="w-8 h-8 grid place-items-center rounded-full bg-stone-100 text-stone-500">⊘</button>
        </div>
      </div>
    </div>
    <div v-else-if="query && !searching" class="mt-4 text-center py-6 text-sm text-stone-500">Ничего не найдено</div>
    <div v-else class="mt-4 text-center py-6 text-xs text-stone-400">Введи имя для поиска</div>
  </Dialog>
</template>
