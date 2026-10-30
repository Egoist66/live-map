<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import Menu from 'primevue/menu'
import Button from 'primevue/button'
import { useAppModulesStore } from '@/stores/appModules'

defineProps<{ menuModel: any; plan: string; pinsToday: number; pinsLimit: string; zoneCount: number; procUnread?: number }>()
const emit = defineEmits<{ (e: 'billing'): void }>()

const modules = useAppModulesStore()
const showMapMetrics = computed(() => modules.isEnabled('upin'))
</script>
<template>
  <aside class="hidden lg:block self-start space-y-4 h-fit shrink-0">
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-3' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="px-2 py-2 text-[11px] font-bold tracking-widest text-stone-400 uppercase">Настройки</div>
        <Menu :model="(menuModel as any)" class="!bg-transparent !border-0 !w-full !p-0" :pt="{ root: { class: '!bg-transparent !border-0 !p-0 !w-full' }, list: { class: '!p-0 !flex !flex-col !gap-1 !bg-transparent' }, item: { class: '!p-0' }, itemContent: { class: '!p-0 !bg-transparent hover:!bg-transparent' }, submenuLabel: { class: '!hidden' } }">
          <template #item="{ item, props: p }">
            <button v-bind="p.action" :class="['w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-colors border box-border', (item as any).active ? '!bg-[#f43f5e] !border-[#f43f5e] !text-white shadow-lg shadow-rose-500/30' : 'border-transparent hover:bg-stone-50 dark:hover:bg-white/10 text-stone-700 dark:text-zinc-300']">
              <span :class="['w-9 h-9 rounded-2xl grid place-items-center text-sm shrink-0', (item as any).active ? 'bg-white/20 !text-white' : 'bg-stone-100 dark:bg-white/10']"><i :class="(item as any).icon" /></span>
              <span class="min-w-0 text-left"><span class="block text-sm font-semibold leading-none">{{ (item as any).label }}</span><span class="block text-xs opacity-60 leading-none mt-1">{{ (item as any).desc }}</span></span>
              <span v-if="(item as any).id === 'procedures' && procUnread" class="ml-auto text-red-500 leading-none">❗</span>
              <span v-else-if="(item as any).active" class="ml-auto text-xs">→</span>
            </button>
          </template>
        </Menu>
        <Card class="!bg-gradient-to-br !from-rose-50 !via-pink-50 !to-fuchsia-50 dark:!from-rose-950/20 dark:!to-fuchsia-950/20 !border-amber-200 dark:!border-amber-900 !rounded-3xl !shadow-none mt-4" :pt="{ body: { class: '!p-3' }, content: { class: '!p-0' } }">
          <template #content>
            <div class="text-xs font-bold dark:text-white">Тариф {{ plan }}</div>
            <div v-if="showMapMetrics" class="text-xs text-stone-600 mt-1">{{ pinsToday }}/{{ pinsLimit }} пинов сегодня · {{ zoneCount }} подписок</div>
            <Button @click="emit('billing')" label="Управление →" link size="small" class="!px-0 !text-xs !font-semibold !mt-2" />
          </template>
        </Card>
      </template>
    </Card>
  </aside>
</template>
