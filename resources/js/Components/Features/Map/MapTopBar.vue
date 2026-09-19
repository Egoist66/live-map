<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useFilterDialog } from '@/composables/useFilterDialog'

const props = defineProps<{ count: number; loading: boolean; refreshing?: boolean; categories: any[]; selectedCategory: any; canDrawDistrict?: boolean }>()
const emit = defineEmits<{ (e: 'update:category', v: any): void; (e: 'info'): void; (e: 'mine'): void; (e: 'refresh'): void; (e: 'districts'): void }>()

const dlg = useFilterDialog()

const activeMeta = computed(() => {
  if (props.selectedCategory === 'mine') return { i: '📍', l: 'Мои' }
  return (props.categories as any[]).find((c: any) => c.v === props.selectedCategory) ?? null
})

const optBase = 'flex items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 active:scale-[0.98] w-full'
const optOn = 'bg-gradient-to-br from-violet-600 to-indigo-600 border-transparent text-white shadow-glow'
const optOff = 'bg-stone-50 dark:bg-white/[0.05] border-stone-200/70 dark:border-white/10 text-ink-900 dark:text-zinc-100 hover:border-violet-300 dark:hover:border-violet-400/40'
const iconOn = 'bg-white/20'
const iconOff = 'bg-white dark:bg-white/10 shadow-sm border border-stone-200/60 dark:border-white/10'
</script>
<template>
  <Card class="pointer-events-auto !rounded-full !shadow-float !border-stone-200/70 dark:!border-white/10 !bg-white/85 dark:!bg-zinc-900/80 backdrop-blur-xl !py-1 !pl-1 !pr-1 min-[411px]:!py-1.5 min-[411px]:!pl-1.5 min-[411px]:!pr-1.5 w-full sm:w-auto max-w-full min-w-0 overflow-hidden" :pt="{ body: { class: '!p-0' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-center gap-1 min-[411px]:gap-1.5 max-w-full min-w-0">
        <button @click="dlg.show()" class="flex-1 sm:flex-none min-w-0 flex items-center gap-1.5 min-[411px]:gap-2 rounded-full pl-2.5 min-[411px]:pl-3 pr-2 min-[411px]:pr-2.5 py-[6px] min-[411px]:py-[7px] text-[12px] min-[411px]:text-[13px] font-bold transition active:scale-95 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-glow hover:opacity-90 border border-transparent">
          <i class="pi pi-sliders-h text-xs shrink-0"></i>
          <span v-if="activeMeta" class="truncate">{{ (activeMeta as any).i }} {{ (activeMeta as any).l }}</span>
          <span v-else class="truncate">Все пины</span>
          <span v-if="selectedCategory !== 'all'" class="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0"></span>
          <span v-if="selectedCategory !== 'all'" @click.stop="emit('update:category', 'all')" class="w-5 h-5 rounded-full bg-white/20 grid place-items-center shrink-0 hover:bg-white/30"><i class="pi pi-times text-[9px]"></i></span>
        </button>
        <Tag @click="emit('info')" :value="String(count)" severity="contrast" rounded class="shrink-0 ml-auto !bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !shadow-soft cursor-pointer hover:opacity-90 !text-sm min-[411px]:!text-base !font-black !px-3 min-[411px]:!px-4 !py-1.5 min-[411px]:!py-2">
          <template #icon><i v-if="loading" class="pi pi-spin pi-spinner text-white dark:text-ink-900"></i><span v-else class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse inline-block"></span></template>
        </Tag>
        <Button icon="pi pi-palette" rounded text size="small" :disabled="!(canDrawDistrict ?? true)" :title="(canDrawDistrict ?? true) ? 'Нарисовать район (зажми Alt и веди мышью с левой кнопкой)' : 'Рисование районов недоступно на телефоне'" :aria-label="(canDrawDistrict ?? true) ? 'Нарисовать район' : 'Рисование районов недоступно на телефоне'" class="shrink-0 !w-[32px] !h-[32px] min-[411px]:!w-[34px] min-[411px]:!h-[34px] !p-0 !text-violet-700 dark:!text-violet-300 disabled:!opacity-40" @click="emit('districts')" />
        <Button icon="pi pi-refresh" rounded text size="small" :loading="!!refreshing" title="Обновить карту" aria-label="Обновить карту" class="shrink-0 !w-[32px] !h-[32px] min-[411px]:!w-[34px] min-[411px]:!h-[34px] !p-0" @click="emit('refresh')" />
      </div>
    </template>
  </Card>

  <Dialog v-model:visible="dlg.open.value" modal dismissableMask :style="{ width: '480px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] !border-stone-200 dark:!border-white/10 overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0' }, content: { class: '!p-5' }, footer: { class: '!p-5 !pt-0 !border-0' } }">
    <template #header>
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white grid place-items-center shadow-glow shrink-0"><i class="pi pi-sliders-h"></i></span>
        <div class="min-w-0"><div class="font-black text-[17px] tracking-tight dark:text-white">Фильтры</div><div class="text-xs text-stone-500 dark:text-zinc-400">Что показать на карте</div></div>
      </div>
    </template>
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-2">
        <button @click="emit('update:category', 'all')" :class="[optBase, selectedCategory === 'all' ? optOn : optOff]">
          <span :class="['w-10 h-10 rounded-xl grid place-items-center text-lg shrink-0', selectedCategory === 'all' ? iconOn : iconOff]">🌍</span>
          <span class="min-w-0"><span class="block text-sm font-bold leading-tight">Все пины</span><span :class="['block text-[11px] leading-tight mt-0.5', selectedCategory === 'all' ? 'text-white/70' : 'text-stone-400 dark:text-zinc-400']">Вся карта</span></span>
          <span v-if="selectedCategory === 'all'" class="ml-auto w-5 h-5 rounded-full bg-white text-violet-600 grid place-items-center text-[10px] shrink-0">✓</span>
        </button>
        <button @click="emit('mine')" :class="[optBase, selectedCategory === 'mine' ? optOn : optOff]">
          <span :class="['w-10 h-10 rounded-xl grid place-items-center text-lg shrink-0', selectedCategory === 'mine' ? iconOn : iconOff]">📍</span>
          <span class="min-w-0"><span class="block text-sm font-bold leading-tight">Мои</span><span :class="['block text-[11px] leading-tight mt-0.5', selectedCategory === 'mine' ? 'text-white/70' : 'text-stone-400 dark:text-zinc-400']">Только свои</span></span>
          <span v-if="selectedCategory === 'mine'" class="ml-auto w-5 h-5 rounded-full bg-white text-violet-600 grid place-items-center text-[10px] shrink-0">✓</span>
        </button>
      </div>
      <div>
        <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 mb-2 px-1">Категории</div>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="c in categories" :key="c.v" @click="emit('update:category', c.v)" :class="[optBase, selectedCategory === c.v ? optOn : optOff]">
            <span :class="['w-10 h-10 rounded-xl grid place-items-center text-lg shrink-0', selectedCategory === c.v ? iconOn : iconOff]">{{ c.i }}</span>
            <span class="min-w-0 text-sm font-bold leading-tight truncate">{{ c.l }}</span>
            <span v-if="selectedCategory === c.v" class="ml-auto w-5 h-5 rounded-full bg-white text-violet-600 grid place-items-center text-[10px] shrink-0">✓</span>
          </button>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex gap-2">
        <Button label="Сбросить" severity="secondary" outlined rounded class="flex-1" @click="emit('update:category', 'all')" />
        <Button :label="`Показать · ${count}`" rounded class="flex-[1.4] !bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !shadow-glow" @click="dlg.hide()" />
      </div>
    </template>
  </Dialog>
</template>
