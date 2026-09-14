<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Checkbox from 'primevue/checkbox'
import Chip from 'primevue/chip'
import { districtInterestLabel } from '@/utils/districtGeo'
import type { District } from '@/types/entities/District'

defineProps<{ open: boolean; nearby: District[]; mine: District[]; loadingMine: boolean; layerVisible: boolean; limitText: string }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'paint'): void
  (e: 'open', id: number): void
  (e: 'toggle-layer'): void
}>()

function roleChip(role: string): string {
  if (role === 'owner') return 'ваш'
  if (role === 'member') return 'житель'
  if (role === 'pending') return 'заявка'
  return 'гость'
}
</script>
<template>
  <Dialog :visible="open" modal dismissableMask header="UDistrict" :style="{ width: '480px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] !border-stone-200 dark:!border-white/10 overflow-hidden' }, header: { class: '!p-5 !pb-0 !border-0' }, content: { class: '!p-5' }, footer: { class: '!p-5 !pt-0 !border-0' } }" @update:visible="(v:boolean)=>emit('update:open', v)">
    <template #header>
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-700 to-purple-900 text-white grid place-items-center shadow-glow shrink-0 text-lg">🏘️</span>
        <div class="min-w-0"><div class="font-black text-[17px] tracking-tight dark:text-white">UDistrict</div><div class="text-xs text-stone-500 dark:text-zinc-400">Свои районы внутри твоей зоны</div></div>
      </div>
    </template>
    <div class="flex flex-col gap-4">
      <button type="button" class="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-700 to-purple-900 text-white p-3.5 shadow-glow transition hover:opacity-95 active:scale-[0.99] text-left" @click="emit('paint')">
        <span class="w-11 h-11 rounded-2xl bg-white/20 grid place-items-center shrink-0"><i class="pi pi-palette" /></span>
        <span class="min-w-0 flex-1"><span class="block text-sm font-black">Нарисовать район</span><span class="block text-[11px] text-white/75 leading-snug">Кисть: зажми Alt и веди мышью, на мобилке — пальцем. Круг зальётся целиком</span></span>
        <i class="pi pi-chevron-right text-white/60 shrink-0" />
      </button>
      <label class="flex items-center gap-2.5 text-[13px] font-semibold dark:text-zinc-100 cursor-pointer select-none">
        <Checkbox :model-value="layerVisible" :binary="true" @update:model-value="emit('toggle-layer')" />
        Показывать заливки на карте
      </label>
      <div>
        <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 mb-1.5 px-1">Мои районы</div>
        <div v-if="loadingMine" class="text-xs text-stone-400 px-1">Загружаем…</div>
        <div v-else-if="mine.length" class="flex flex-col gap-1.5">
          <button v-for="d in mine" :key="d.id" type="button" class="flex items-center gap-2.5 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/60 dark:bg-violet-950/20 p-2.5 text-left transition active:scale-[0.99]" @click="emit('open', d.id)">
            <span class="min-w-0 flex-1"><span class="block text-[13px] font-bold truncate dark:text-white">{{ d.name }}</span><span class="block text-[11px] text-stone-400 dark:text-zinc-500">{{ districtInterestLabel(d.interest) }} · {{ d.members_count }} жит.</span></span>
            <Chip :label="roleChip(d.role)" class="!rounded-full !text-[10px] shrink-0" />
          </button>
        </div>
        <div v-else class="text-xs text-stone-400 dark:text-zinc-500 rounded-2xl border border-dashed border-stone-300 dark:border-zinc-700 p-3 text-center">{{ limitText }}</div>
      </div>
      <div v-if="nearby.length">
        <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 mb-1.5 px-1">Рядом на карте · {{ nearby.length }}</div>
        <div class="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
          <button v-for="d in nearby.slice(0, 20)" :key="d.id" type="button" class="flex items-center gap-2.5 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-white/[0.04] p-2.5 text-left transition active:scale-[0.99]" @click="emit('open', d.id)">
            <span class="min-w-0 flex-1"><span class="block text-[13px] font-bold truncate dark:text-white">{{ d.name }}</span><span class="block text-[11px] text-stone-400 dark:text-zinc-500">{{ districtInterestLabel(d.interest) }} · {{ d.members_count }} жит.</span></span>
            <i class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0" />
          </button>
        </div>
      </div>
    </div>
  </Dialog>
</template>
