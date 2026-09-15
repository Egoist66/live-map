<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Card from 'primevue/card'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import { avatarSrcFor } from '@/composables/useAvatar'

defineProps<{ list: any[]; meta: any; page: number; limit: number; query: string; loading: boolean }>()
const emit = defineEmits<{
  (e: 'update:query', v: string): void
  (e: 'limit', v: number): void
  (e: 'page', v: number): void
}>()

const limitOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

function ago(iso?: string | null) {
  if (!iso) return '—'
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60000) return 'только что'
  if (d < 3600000) return Math.floor(d / 60000) + ' мин назад'
  if (d < 86400000) return Math.floor(d / 3600000) + ' ч назад'
  return Math.floor(d / 86400000) + ' д назад'
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="font-black dark:text-white flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />Онлайн <span class="text-xs font-bold text-stone-400 dark:text-zinc-500">· {{ meta.total }}</span></div>
        <div class="ml-auto flex items-center gap-1.5">
          <span class="text-[11px] text-stone-400 dark:text-zinc-500 font-semibold">выборка:</span>
          <SelectButton :modelValue="limit" @update:modelValue="(v:number)=>emit('limit', v)" :options="limitOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="flex-wrap max-w-full" />
        </div>
      </div>
      <IconField class="mt-3">
        <InputIcon class="pi pi-search" />
        <InputText :modelValue="query" @update:modelValue="(v:string|undefined)=>emit('update:query', v ?? '')" placeholder="Фильтр по имени или email..." fluid size="small" rounded />
      </IconField>
      <div v-if="loading" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!list.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Никого нет в онлайне</div>
      <div v-else class="mt-3 divide-y divide-stone-100 dark:divide-zinc-800">
        <div v-for="u in list" :key="u.id" class="flex items-center gap-2.5 py-2.5">
          <div class="relative shrink-0">
            <Avatar :image="avatarSrcFor(u)" shape="circle" class="!w-9 !h-9 [&_img]:object-cover" />
            <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold truncate dark:text-white">{{ u.name }} <Tag v-if="u.is_admin" value="МОДЕРАТОР" severity="warn" class="!text-[9px] !py-0 ml-1" /></div>
            <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ u.email }} · {{ u.plan }} · {{ ago(u.last_seen_at) }}</div>
          </div>
        </div>
      </div>
      <Paginator v-if="meta.last_page > 1" :rows="meta.per_page" :totalRecords="meta.total" :first="(page - 1) * meta.per_page" @page="(e:any)=>emit('page', e.page + 1)" class="!bg-transparent !border-0 !px-0" />
    </template>
  </Card>
</template>
