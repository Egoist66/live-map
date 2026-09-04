<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

defineProps<{ pins: any[]; loading: boolean; deleting: boolean; formatDate: (s: string) => string; formatTime: (s: string) => string }>()
const emit = defineEmits<{ (e: 'delete', id: number): void }>()
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Мои пины</h3>
      <p class="text-sm text-stone-500 mt-1">Правый клик по пину на карте тоже удаляет. Здесь — полный список.</p>
      <div v-if="loading" class="mt-5 flex items-center gap-2 text-sm text-stone-500"><span class="w-4 h-4 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></span> Загружаем…</div>
      <div v-else-if="pins.length" class="mt-5 grid sm:grid-cols-2 gap-3">
        <Card v-for="p in pins" :key="p.id" class="!border-stone-200 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-800 relative" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <Button @click="emit('delete', p.id)" :loading="deleting" rounded text severity="secondary" class="!absolute !top-3 !right-3 !w-7 !h-7 !p-0" icon="pi pi-times" aria-label="Удалить" />
            <div class="text-sm font-bold pr-8 truncate dark:text-white">{{ p.title }}</div>
            <div class="text-xs text-stone-500 mt-1 line-clamp-2">{{ p.body }}</div>
            <div class="flex items-center gap-1.5 mt-3 text-[11px]"><Tag :value="p.category" class="!bg-stone-900 !text-white !rounded-full !text-[11px]" /><Tag :value="`${formatDate(p.expires_at)} ${formatTime(p.expires_at)}`" class="!bg-stone-100 !text-stone-600 !rounded-full !text-[11px]" /></div>
          </template>
        </Card>
      </div>
      <Card v-else class="!border-dashed !border-stone-200 !rounded-3xl !shadow-none mt-6 text-center !bg-white" :pt="{ body: { class: '!py-8' }, content: { class: '!p-0' } }">
        <template #content>
          <div class="w-10 h-10 rounded-xl bg-stone-100 border mx-auto grid place-items-center">📍</div><div class="text-sm font-medium mt-2">Пока нет пинов</div><div class="text-xs text-stone-400">Создай первый на карте</div><Link href="/map" class="mt-3 inline-flex"><Button label="На карту →" rounded size="small" class="!bg-stone-900 !border-stone-900 !text-white" /></Link>
        </template>
      </Card>
    </template>
  </Card>
</template>
