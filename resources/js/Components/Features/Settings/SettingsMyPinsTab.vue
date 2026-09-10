<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import { usePinAudience } from '@/composables/usePinAudience'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

defineProps<{ pins: any[]; loading: boolean; deleting: boolean; updatingId?: number | null; formatDate: (s: string) => string; formatTime: (s: string) => string }>()

const emit = defineEmits<{ (e: 'delete', id: number): void; (e: 'audience', id: number, v: string): void }>()
const audience = usePinAudience()
const { selectPt } = useDropdownMenuStyle()

function isScheduled(p: any): boolean {
  return p?.status === 'scheduled' || !!p?.is_scheduled
}
function scheduleLabel(p: any): string {
  if (!p?.publish_at) return 'запланирован'
  try {
    return new Date(p.publish_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return 'запланирован' }
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Мои пины</h3>
      <p class="text-sm text-stone-500 mt-1">Правый клик по пину на карте тоже удаляет. Здесь — полный список, включая запланированные.</p>
      <div v-if="loading" class="mt-5 flex items-center gap-2 text-sm text-stone-500"><span class="w-4 h-4 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></span> Загружаем…</div>
      <div v-else-if="pins.length" class="mt-5 grid sm:grid-cols-2 gap-3">
        <Card v-for="p in pins" :key="p.id" class="!border-stone-200 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-800 relative" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <Button @click="emit('delete', p.id)" :loading="deleting" rounded text severity="secondary" class="!absolute !top-3 !right-3 !w-7 !h-7 !p-0" icon="pi pi-times" aria-label="Удалить" />
            <div class="text-sm font-bold pr-8 truncate dark:text-white">{{ p.title }}</div>
            <div class="text-xs text-stone-500 mt-1 line-clamp-2">{{ p.body }}</div>
            <div class="flex items-center gap-1.5 mt-3 text-[11px] flex-wrap">
              <Tag :value="p.category" class="!bg-stone-900 !text-white !rounded-full !text-[11px]" />
              <Tag v-if="(p.gender_audience ?? 'all') === 'female'" value="👩 Только женщины" class="!bg-pink-600 !text-white !rounded-full !text-[11px] !border-0" />
              <Tag v-else-if="(p.gender_audience ?? 'all') === 'male'" value="👨 Только мужчины" class="!bg-sky-600 !text-white !rounded-full !text-[11px] !border-0" />
              <Tag v-else value="🌍 Все" class="!bg-emerald-600 !text-white !rounded-full !text-[11px] !border-0" />
              <Tag v-if="isScheduled(p)" :value="`🕓 ${scheduleLabel(p)}`" class="!bg-violet-600 !text-white !rounded-full !text-[11px] !border-0" />
              <Tag v-else :value="p.expires_at ? `${formatDate(p.expires_at)} ${formatTime(p.expires_at)}` : '∞ бессрочно'" class="!bg-stone-100 !text-stone-600 !rounded-full !text-[11px]" />
            </div>
            <div class="mt-3">
              <label class="text-[11px] font-bold uppercase tracking-wide text-stone-500">Кто видит</label>
              <Select :model-value="p.gender_audience ?? 'all'" :options="audience.options" optionLabel="label" optionValue="value" checkmark fluid size="small" class="w-full mt-1 !rounded-xl" :pt="selectPt" :loading="updatingId === p.id" :disabled="updatingId === p.id" @update:model-value="(v: string) => emit('audience', p.id, v)" />
            </div>
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
