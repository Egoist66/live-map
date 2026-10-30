<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Menu from 'primevue/menu'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

defineProps<{ user: any; avatarSrc: string; items: any[] }>()
defineExpose({})
const menuRef = defineModel<any>('menuRef')
const { menuItemClass, menuPt } = useDropdownMenuStyle()

const chip: Record<string, string> = {
  violet: 'bg-violet-500/15 text-violet-600 dark:!bg-violet-500/15 dark:!text-violet-300',
  slate: 'bg-stone-200/70 text-stone-600 dark:!bg-white/10 dark:!text-zinc-300',
  teal: 'bg-teal-500/15 text-teal-600 dark:!bg-teal-500/15 dark:!text-teal-300',
  red: 'bg-red-500/10 text-red-600 dark:!bg-red-500/15 dark:!text-red-400',
  sky: 'bg-sky-500/15 text-sky-600 dark:!bg-sky-500/15 dark:!text-sky-300',
}
</script>
<template>
  <Menu ref="menuRef" :model="items" popup class="!min-w-[280px] !p-0 !bg-white dark:!bg-[#0F121F]/95 dark:!backdrop-blur-xl !border !border-stone-200 dark:!border-white/10 !rounded-[20px] !shadow-float dark:!shadow-[0_24px_70px_-16px_rgba(0,0,0,0.8)] !overflow-hidden" :pt="menuPt">
    <template #item="{ item, props }">
      <div v-if="(item as any).isHeader" class="px-4 pt-4 pb-3 flex gap-3 items-center bg-transparent">
        <Avatar :image="avatarSrc" shape="circle" size="large" class="!w-10 !h-10 ring-2 ring-white dark:!ring-white/20 shadow" />
        <div class="min-w-0"><div class="text-sm font-bold truncate text-ink-900 dark:!text-white">{{ user?.name }}</div><div class="text-xs text-stone-500 dark:!text-zinc-400 truncate">{{ user?.email }}</div></div>
      </div>
      <a v-else-if="(item as any).separator" class="my-1.5 mx-3 border-t border-stone-200 dark:!border-white/5 block" />
      <a v-else v-bind="props.action" :class="[menuItemClass, (item as any).active ? '!bg-[#F04D9F]/10 dark:!bg-[#F04D9F]/15' : '']">
        <span :class="['w-9 h-9 rounded-xl grid place-items-center text-sm shrink-0', chip[(item as any).accent] || chip.slate]">
          <svg v-if="(item as any).svg === 'flow'" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6" /></svg>
          <i v-else :class="(item as any).icon" />
        </span>
        <span :class="['text-sm flex-1 font-semibold', (item as any).danger ? 'text-red-600 dark:!text-red-400' : (item as any).active ? '!text-[#F04D9F] dark:!text-white' : 'text-stone-700 dark:!text-zinc-100']">{{ (item as any).label }}</span>
        <i v-if="!(item as any).danger" class="pi pi-angle-right text-[10px] text-stone-300 dark:!text-zinc-600" />
      </a>
    </template>
  </Menu>
</template>
