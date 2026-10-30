<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'

defineProps<{
  open: boolean
  districtName: string
  query: string
  results: any[]
  searching: boolean
  invitingId: number
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'update:query', v: string): void
  (e: 'invite', userId: number): void
}>()
</script>
<template>
  <Dialog
    :visible="open"
    modal
    dismissableMask
    header="Пригласить в район"
    :style="{ width: '440px', maxWidth: '94vw' }"
    :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-white/10 overflow-hidden' }, content: { class: '!p-5 !pt-2' }, header: { class: '!p-5 !pb-0 !border-0' } }"
    @update:visible="(v:boolean)=>emit('update:open', v)"
  >
    <div class="text-xs text-stone-500 dark:text-zinc-400 mb-3">
      {{ districtName ? `«${districtName}» — человек сразу станет жителем` : 'Человек сразу станет жителем' }} и увидит район даже вне своей зоны
    </div>
    <div class="relative w-full">
      <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-500 text-sm pointer-events-none z-[1]" />
      <InputText :model-value="query" placeholder="Имя, например Петр..." fluid enterkeyhint="search" class="!rounded-full !pl-10 !pr-10 !py-2.5" @update:model-value="emit('update:query', String($event ?? ''))" />
      <i v-if="searching" class="pi pi-spin pi-spinner absolute right-3.5 top-1/2 -translate-y-1/2 text-violet-400 text-sm pointer-events-none" />
    </div>
    <Message v-if="error" severity="error" :closable="false" class="!rounded-2xl !text-xs mt-3">{{ error }}</Message>
    <div v-if="results.length" class="mt-3 max-h-[320px] overflow-auto divide-y border rounded-2xl bg-white dark:bg-[#0F121F] dark:border-white/10">
      <div v-for="u in results" :key="u.id" class="flex items-center gap-2.5 p-2.5">
        <Avatar :image="u.avatar_url ?? undefined" :label="!u.avatar_url ? (u.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-9 !h-9 shrink-0" />
        <div class="min-w-0 flex-1 text-sm font-bold truncate dark:text-white">{{ u.name }}</div>
        <Button
          icon="pi pi-user-plus"
          label="Звать"
          rounded
          size="small"
          :loading="invitingId === u.id"
          class="!bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !border-0 !text-white"
          @click="emit('invite', u.id)"
        />
      </div>
    </div>
    <div v-else-if="query.trim().length >= 2 && !searching" class="mt-3 text-center py-5 text-sm text-stone-500 dark:text-zinc-400">Ничего не найдено</div>
    <div v-else class="mt-3 text-center py-5 text-xs text-stone-400 dark:text-zinc-500">Введи имя — минимум 2 символа</div>
  </Dialog>
</template>
