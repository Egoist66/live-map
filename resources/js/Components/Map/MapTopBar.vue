<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import SelectButton from 'primevue/selectbutton'

defineProps<{ count: number; loading: boolean; categories: any[]; selectedCategory: any }>()
const emit = defineEmits<{ (e: 'update:category', v: any): void; (e: 'info'): void; (e: 'mine'): void }>()
</script>
<template>
  <Card class="pointer-events-auto !rounded-2xl sm:!rounded-full !shadow-soft !border-stone-200 !bg-white/95 backdrop-blur !p-1.5 sm:!pl-2 sm:!pr-2 w-full max-w-full overflow-hidden" :pt="{ body: { class: '!p-0 w-full' }, content: { class: '!p-0 w-full' } }">
    <template #content>
      <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full snap-x">
        <Tag @click="emit('info')" :value="String(count)" severity="contrast" rounded class="shrink-0 !bg-stone-900 !text-white cursor-pointer hover:opacity-90 snap-start">
          <template #icon><span v-if="loading" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span><span v-else class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse inline-block"></span></template>
        </Tag>
        <div class="h-5 w-px bg-stone-200 shrink-0 hidden sm:block"></div>
        <SelectButton :model-value="selectedCategory" @update:model-value="(v:any)=>emit('update:category', v)" :options="[{ label: 'Все', value: 'all' }, { label: '📍 Мои', value: 'mine' }, ...categories.map((c:any)=>({ label: `${c.i} ${c.l}`, value: c.v }))]" optionLabel="label" optionValue="value" class="hidden sm:flex shrink-0" :allowEmpty="false" :pt="{ button: { class: '!rounded-full !text-xs !py-1.5 !px-3.5 !whitespace-nowrap' } }" />
        <div class="flex sm:hidden items-center gap-1.5 overflow-x-auto scrollbar-none snap-x flex-1 min-w-0">
          <Button label="Все" size="small" rounded :severity="selectedCategory === 'all' ? 'contrast' : 'secondary'" :outlined="selectedCategory !== 'all'" @click="emit('update:category', 'all')" class="shrink-0 !text-xs snap-start" />
          <Button label="📍 Мои" size="small" rounded :severity="selectedCategory === 'mine' ? 'warn' : 'secondary'" :outlined="selectedCategory !== 'mine'" @click="emit('mine')" class="shrink-0 !text-xs snap-start" />
          <Chip v-for="c in categories.slice(0, 4)" :key="c.v" :label="c.i" @click="emit('update:category', c.v)" :class="selectedCategory === c.v ? '!bg-stone-900 !text-white !border-stone-900' : '!bg-white !border-stone-200 border'" class="shrink-0 cursor-pointer !rounded-full snap-start !text-xs !py-1" />
        </div>
      </div>
    </template>
  </Card>
</template>
