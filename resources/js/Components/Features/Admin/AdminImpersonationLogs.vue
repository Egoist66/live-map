<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'

defineProps<{ logs: any }>()

const filterOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Не прочитано', value: 'unread' },
  { label: 'Прочитано', value: 'read' },
]

function fmt(dt: string | null) {
  if (!dt) return '—'
  try { return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return dt }
}
</script>
<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2">
        <div class="font-black dark:text-white">Входы в аккаунты</div>
        <Tag v-if="logs.unreadCount.value" :value="`не прочитано: ${logs.unreadCount.value}`" severity="danger" class="!text-[9px]" />
        <Button label="обновить" link size="small" class="ml-auto !text-xs !px-1" @click="logs.load()" />
      </div>
      <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Кто, в чей аккаунт, основание и прочитал ли пользователь.</p>
      <IconField class="mt-3">
        <InputIcon class="pi pi-search" />
        <InputText :modelValue="logs.query.value" @update:modelValue="(v:string|undefined)=>logs.setQuery(v ?? '')" placeholder="Имя, email или основание..." fluid size="small" rounded />
      </IconField>
      <SelectButton :modelValue="logs.filter.value" @update:modelValue="(v:string)=>logs.setFilter(v as any)" :options="filterOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" class="mt-2.5 flex-wrap max-w-full admin-filter-pills" />
      <div v-if="logs.loading.value" class="py-8 grid place-items-center"><ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" /></div>
      <div v-else-if="!logs.items.value.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Входов пока нет</div>
      <div v-else class="admin-list-scroll mt-3 space-y-2 pr-1">
        <div v-for="l in logs.items.value" :key="l.id" class="rounded-2xl border border-stone-200 dark:border-white/10 p-3">
          <div class="flex items-center gap-2 min-w-0">
            <i class="pi pi-eye text-red-500 text-sm shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-[13px] font-semibold truncate dark:text-white">{{ l.target?.name || ('#' + l.target?.id) }} <span class="font-normal text-stone-400">· {{ l.target?.email || '' }}</span></div>
              <div class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">модератор: {{ l.admin?.name || ('#' + l.admin?.id) }} · {{ fmt(l.started_at) }}</div>
            </div>
            <Tag v-if="l.seen_at" value="прочитано" severity="success" class="!text-[9px]" />
            <Tag v-else value="не прочитано" severity="danger" class="!text-[9px]" />
          </div>
          <div class="mt-1.5 text-[13px] text-stone-600 dark:text-zinc-300 leading-relaxed">Основание: {{ l.reason }}</div>
          <div class="mt-1 text-[11px] text-stone-400">Завершён: {{ fmt(l.ended_at) }} · Прочитано: {{ fmt(l.seen_at) }}</div>
        </div>
      </div>
      <Paginator v-if="logs.meta.value.last_page > 1" :rows="logs.meta.value.per_page" :totalRecords="logs.meta.value.total" :first="(logs.page.value - 1) * logs.meta.value.per_page" @page="(e:any)=>logs.setPage(e.page + 1)" class="!bg-transparent !border-0 !px-0" />
      <Message v-if="logs.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ logs.error.value }}</Message>
    </template>
  </Card>
</template>
