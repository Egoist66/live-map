<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import Select from 'primevue/select'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { usePinAudience } from '@/composables/usePinAudience'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useMyPinsTabs } from '@/composables/useMyPinsTabs'

const props = defineProps<{ pins: any[]; loading: boolean; deleting: boolean; updatingId?: number | null; formatDate: (s: string) => string; formatTime: (s: string) => string }>()

const emit = defineEmits<{ (e: 'delete', id: number): void; (e: 'audience', id: number, v: string): void }>()
const audience = usePinAudience()
const { selectPt } = useDropdownMenuStyle()
const tabs = useMyPinsTabs(() => props.pins)
</script>
<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Мои пины</h3>
      <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Правый клик по пину на карте тоже удаляет. Запланированные опубликуются сами в выбранное время.</p>
      <div v-if="loading" class="mt-5 flex items-center gap-2 text-sm text-stone-500"><span class="w-4 h-4 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></span> Загружаем…</div>
      <Tabs v-else :value="tabs.activeTab.value" @update:value="(v:any)=>{ if (v === 'all' || v === 'scheduled') tabs.setTab(v) }" class="mt-4 w-full">
        <TabList class="!bg-transparent" :pt="{ activeBar: { class: '!bg-violet-600' } }">
          <Tab value="all" class="!text-[13px] !font-bold whitespace-nowrap">Все<Badge v-if="tabs.activeCount.value" :value="String(tabs.activeCount.value)" severity="secondary" class="ml-1.5 !text-[10px]" /></Tab>
          <Tab value="scheduled" class="!text-[13px] !font-bold whitespace-nowrap">🕓 Запланированные<Badge v-if="tabs.scheduledCount.value" :value="String(tabs.scheduledCount.value)" severity="info" class="ml-1.5 !text-[10px]" /></Tab>
        </TabList>
        <TabPanels class="!bg-transparent !p-0 !pt-4">
          <TabPanel value="all">
            <div v-if="tabs.visiblePins.value.length" class="grid sm:grid-cols-2 gap-3">
              <Card v-for="p in tabs.visiblePins.value" :key="p.id" class="!border-stone-200 !rounded-3xl !shadow-none !bg-white dark:!bg-white/10 relative" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
                <template #content>
                  <Button @click="emit('delete', p.id)" :loading="deleting" rounded text severity="secondary" class="!absolute !top-3 !right-3 !w-7 !h-7 !p-0" icon="pi pi-times" aria-label="Удалить" />
                  <div class="text-sm font-bold pr-8 truncate dark:text-white">{{ p.title }}</div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1 line-clamp-2">{{ p.body }}</div>
                  <div class="flex items-center gap-1.5 mt-3 text-[11px] flex-wrap">
                    <Tag :value="p.category" class="!bg-stone-900 !text-white !rounded-full !text-[11px]" />
                    <Tag v-if="(p.gender_audience ?? 'all') === 'female'" value="👩 Только женщины" class="!bg-pink-600 !text-white !rounded-full !text-[11px] !border-0" />
                    <Tag v-else-if="(p.gender_audience ?? 'all') === 'male'" value="👨 Только мужчины" class="!bg-sky-600 !text-white !rounded-full !text-[11px] !border-0" />
                    <Tag v-else value="🌍 Все" class="!bg-emerald-600 !text-white !rounded-full !text-[11px] !border-0" />
                    <Tag v-if="tabs.isScheduledPin(p)" :value="`🕓 ${tabs.scheduleDateLabel(p.publish_at)}`" class="!bg-violet-600 !text-white !rounded-full !text-[11px] !border-0" />
                    <Tag v-else :value="p.expires_at ? `${formatDate(p.expires_at)} ${formatTime(p.expires_at)}` : '∞ бессрочно'" class="!bg-stone-100 !text-stone-600 !rounded-full !text-[11px]" />
                  </div>
                  <div class="mt-3">
                    <label class="text-[11px] font-bold uppercase tracking-wide text-stone-500">Кто видит</label>
                    <Select :model-value="p.gender_audience ?? 'all'" :options="audience.options" optionLabel="label" optionValue="value" checkmark fluid size="small" class="w-full mt-1 !rounded-xl" :pt="selectPt" :loading="updatingId === p.id" :disabled="updatingId === p.id" @update:model-value="(v: string) => emit('audience', p.id, v)" />
                  </div>
                </template>
              </Card>
            </div>
            <Card v-else class="!border-dashed !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-none mt-2 text-center !bg-white dark:!bg-[#0F121F]" :pt="{ body: { class: '!py-8' }, content: { class: '!p-0' } }">
              <template #content>
                <div class="w-10 h-10 rounded-xl bg-stone-100 dark:bg-white/10 border dark:border-white/10 mx-auto grid place-items-center">📍</div><div class="text-sm font-medium mt-2 dark:text-white">Пока нет пинов</div><div class="text-xs text-stone-400">Создай первый на карте</div><Link href="/map" class="mt-3 inline-flex"><Button label="На карту →" rounded size="small" class="!bg-stone-900 !border-stone-900 !text-white" /></Link>
              </template>
            </Card>
          </TabPanel>
          <TabPanel value="scheduled">
            <div v-if="tabs.scheduledPins.value.length" class="grid sm:grid-cols-2 gap-3">
              <Card v-for="p in tabs.scheduledPins.value" :key="p.id" class="!border-violet-200 dark:!border-violet-500/30 !rounded-3xl !shadow-none !bg-violet-50/50 dark:!bg-violet-950/20 relative" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
                <template #content>
                  <Button @click="emit('delete', p.id)" :loading="deleting" rounded text severity="danger" class="!absolute !top-3 !right-3 !w-7 !h-7 !p-0" icon="pi pi-times" aria-label="Отменить публикацию" title="Отменить публикацию" />
                  <div class="text-sm font-bold pr-8 truncate dark:text-white">{{ p.title }}</div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1 line-clamp-2">{{ p.body }}</div>
                  <div class="flex items-center gap-1.5 mt-3 text-[11px] flex-wrap">
                    <Tag :value="`⏳ ${tabs.scheduleCountdownLabel(p.publish_at)}`" class="!bg-violet-600 !text-white !rounded-full !text-[11px] !border-0" />
                    <Tag :value="`🕓 ${tabs.scheduleDateLabel(p.publish_at)}`" class="!bg-white dark:!bg-white/10 !text-violet-700 dark:!text-violet-300 !rounded-full !text-[11px] !border !border-violet-200 dark:!border-violet-500/30" />
                  </div>
                  <div class="flex items-center gap-1.5 mt-2 text-[11px] flex-wrap">
                    <Tag :value="p.category" class="!bg-stone-900 !text-white !rounded-full !text-[11px]" />
                    <Tag v-if="(p.gender_audience ?? 'all') === 'female'" value="👩 Только женщины" class="!bg-pink-600 !text-white !rounded-full !text-[11px] !border-0" />
                    <Tag v-else-if="(p.gender_audience ?? 'all') === 'male'" value="👨 Только мужчины" class="!bg-sky-600 !text-white !rounded-full !text-[11px] !border-0" />
                    <Tag v-else value="🌍 Все" class="!bg-emerald-600 !text-white !rounded-full !text-[11px] !border-0" />
                  </div>
                  <div class="mt-3">
                    <label class="text-[11px] font-bold uppercase tracking-wide text-stone-500">Кто увидит</label>
                    <Select :model-value="p.gender_audience ?? 'all'" :options="audience.options" optionLabel="label" optionValue="value" checkmark fluid size="small" class="w-full mt-1 !rounded-xl" :pt="selectPt" :loading="updatingId === p.id" :disabled="updatingId === p.id" @update:model-value="(v: string) => emit('audience', p.id, v)" />
                  </div>
                </template>
              </Card>
            </div>
            <Card v-else class="!border-dashed !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-none text-center !bg-white dark:!bg-[#0F121F]" :pt="{ body: { class: '!py-8' }, content: { class: '!p-0' } }">
              <template #content>
                <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 border dark:border-violet-500/20 mx-auto grid place-items-center">🕓</div><div class="text-sm font-medium mt-2 dark:text-white">Нет запланированных пинов</div><div class="text-xs text-stone-400">Создай пин на карте и выбери дату публикации — он появится здесь</div><Link href="/map" class="mt-3 inline-flex"><Button label="Запланировать пин →" rounded size="small" class="!bg-violet-600 !border-violet-600 !text-white" /></Link>
              </template>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </Card>
</template>
