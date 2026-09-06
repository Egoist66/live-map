<script setup lang="ts">
import Card from 'primevue/card'
import SelectButton from 'primevue/selectbutton'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

defineProps<{ points: any[]; max: number; days: number; loading: boolean; summary: any | null; exporting: boolean }>()
const emit = defineEmits<{ (e: 'days', v: number): void; (e: 'export'): void }>()

const dayOptions = [
  { label: '7д', value: 7 },
  { label: '14д', value: 14 },
  { label: '30д', value: 30 },
]

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  } catch { return iso }
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-2 flex-wrap">
        <div class="font-black dark:text-white">Активность · регистрации · пины</div>
        <div class="ml-auto flex gap-1.5 items-center flex-wrap">
          <SelectButton :modelValue="days" @update:modelValue="(v:number)=>emit('days', v)" :options="dayOptions" optionLabel="label" optionValue="value" :allowEmpty="false" size="small" />
          <Button icon="pi pi-file-excel" label="Excel" size="small" rounded severity="success" outlined :loading="exporting" @click="emit('export')" v-tooltip.bottom="'Скачать отчёт .xlsx'" />
        </div>
      </div>

      <Message severity="info" :closable="false" class="!mt-3 !rounded-2xl !text-xs">
        <b>Регистрации</b> — новые аккаунты за день. <b>Активные</b> — пользователи, открывавшие приложение в этот день.
        <b>Пины</b> — созданные метки. <b>Онлайн сейчас</b> — были в сети последние 3 минуты.
      </Message>

      <div v-if="summary" class="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div class="rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900 p-3">
          <div class="text-[11px] font-bold text-violet-500 dark:text-violet-300 uppercase tracking-wide">Новых за период</div>
          <div class="text-xl font-black dark:text-white">{{ summary.total_registrations }}</div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400">~{{ summary.avg_registrations }} в день</div>
        </div>
        <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 p-3">
          <div class="text-[11px] font-bold text-emerald-600 dark:text-emerald-300 uppercase tracking-wide">Активность</div>
          <div class="text-xl font-black dark:text-white">{{ summary.total_active_hits }}</div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400">~{{ summary.avg_active }} в день</div>
        </div>
        <div class="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 p-3">
          <div class="text-[11px] font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wide">Лучший день</div>
          <div class="text-xl font-black dark:text-white">{{ summary.best_registrations_day?.label ?? '—' }}</div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400">+{{ summary.best_registrations_day?.value ?? 0 }} рег.</div>
        </div>
        <div class="rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 p-3">
          <div class="text-[11px] font-bold text-sky-600 dark:text-sky-300 uppercase tracking-wide">Рост к пред. периоду</div>
          <div class="text-xl font-black dark:text-white flex items-center gap-1.5">
            {{ summary.registrations_growth_pct > 0 ? '+' : '' }}{{ summary.registrations_growth_pct }}%
            <Tag :value="summary.registrations_growth_pct >= 0 ? 'рост' : 'спад'" :severity="summary.registrations_growth_pct >= 0 ? 'success' : 'danger'" class="!text-[9px]" />
          </div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400">было {{ summary.prev_period_registrations }}</div>
        </div>
      </div>

      <div class="mt-2 flex gap-3 text-[11px] text-stone-500 dark:text-zinc-400">
        <span class="flex items-center gap-1"><i class="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block" /> регистрации</span>
        <span class="flex items-center gap-1"><i class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> активные</span>
        <span class="flex items-center gap-1"><i class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> пины</span>
      </div>
      <div v-if="loading" class="py-10 grid place-items-center"><ProgressSpinner style="width:28px;height:28px" :strokeWidth="6" /></div>
      <div v-else-if="!points.length" class="py-8 text-center text-sm text-stone-400 dark:text-zinc-500">Нет данных</div>
      <div v-else class="mt-4 flex items-end gap-1.5 h-36 sm:h-44">
        <div v-for="p in points" :key="p.date" :title="`${p.label}: +${p.registrations} рег / ${p.active} акт / ${p.pins} пинов, всего ${p.total}`" class="flex-1 flex flex-col justify-end items-center gap-1 min-w-0">
          <div class="w-full flex items-end justify-center gap-[2px] h-28 sm:h-36">
            <div class="w-1/3 max-w-[10px] rounded-t-md bg-violet-600 transition-all" :style="{ height: Math.max(3, (p.registrations / max) * 100) + '%' }" />
            <div class="w-1/3 max-w-[10px] rounded-t-md bg-emerald-500 transition-all" :style="{ height: Math.max(3, (p.active / max) * 100) + '%' }" />
            <div class="w-1/3 max-w-[10px] rounded-t-md bg-amber-400 transition-all" :style="{ height: Math.max(3, (p.pins / max) * 100) + '%' }" />
          </div>
          <div class="text-[9px] text-stone-400 dark:text-zinc-500 truncate">{{ p.label }}</div>
        </div>
      </div>

      <div v-if="points.length" class="mt-4">
        <div class="text-xs font-bold text-stone-500 dark:text-zinc-400 mb-2">Детализация по дням</div>
        <DataTable :value="points" size="small" stripedRows paginator :rows="7" :rowsPerPageOptions="[7, 14, 30]" sortField="date" :sortOrder="-1" class="!text-[13px]">
          <Column field="date" header="Дата" sortable>
            <template #body="{ data }">{{ fmtDate(data.date) }}<span class="text-stone-400 dark:text-zinc-500"> · {{ data.date }}</span></template>
          </Column>
          <Column field="registrations" header="Регистрации" sortable />
          <Column field="active" header="Активные" sortable />
          <Column field="pins" header="Пины" sortable />
          <Column field="total" header="Всего" sortable />
        </DataTable>
      </div>
    </template>
  </Card>
</template>
