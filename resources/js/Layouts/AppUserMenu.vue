<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Menu from 'primevue/menu'

defineProps<{ user: any; avatarSrc: string; items: any[] }>()
defineExpose({})
const menuRef = defineModel<any>('menuRef')

const chip: Record<string, string> = {
  violet: 'bg-violet-500/15 text-violet-600 dark:!bg-violet-500/15 dark:!text-violet-300',
  slate: 'bg-stone-200/70 text-stone-600 dark:!bg-zinc-500/15 dark:!text-zinc-300',
  teal: 'bg-teal-500/15 text-teal-600 dark:!bg-teal-500/15 dark:!text-teal-300',
  red: 'bg-red-500/10 text-red-600 dark:!bg-red-500/15 dark:!text-red-400',
}
</script>
<template>
  <Menu ref="menuRef" :model="items" popup class="!min-w-[280px] !p-0 !bg-white dark:!bg-zinc-900/95 dark:!backdrop-blur-xl !border !border-stone-200 dark:!border-white/10 !rounded-[20px] !shadow-float dark:!shadow-[0_24px_70px_-16px_rgba(0,0,0,0.8)] !overflow-hidden" :pt="{ root: { class: '!bg-white dark:!bg-zinc-900/95 dark:!backdrop-blur-xl !border !border-stone-200 dark:!border-white/10 !rounded-[20px] !shadow-float dark:!shadow-[0_24px_70px_-16px_rgba(0,0,0,0.8)] !overflow-hidden !p-0' }, list: { class: '!bg-transparent !p-1.5' }, item: { class: '!bg-transparent' } }">
    <template #item="{ item, props }">
      <div v-if="(item as any).isHeader" class="relative px-4 py-4 flex gap-3 items-center overflow-hidden border-b border-stone-200 dark:border-white/5 bg-stone-50/60 dark:!bg-zinc-900">
        <div class="absolute inset-0 dark:bg-gradient-to-br dark:from-white/[0.07] dark:via-transparent dark:to-transparent pointer-events-none"></div>
        <Avatar :image="avatarSrc" shape="circle" size="large" class="!w-10 !h-10 relative ring-2 ring-white dark:!ring-white/20 shadow" />
        <div class="relative min-w-0"><div class="text-sm font-bold truncate text-ink-900 dark:!text-white">{{ user?.name }}</div><div class="text-xs text-stone-500 dark:!text-zinc-400 truncate">{{ user?.email }}</div></div>
      </div>
      <a v-else-if="(item as any).separator" class="my-1.5 mx-3 border-t border-stone-200 dark:!border-white/5 block" />
      <a v-else v-bind="props.action" :class="['group flex items-center gap-3 px-2.5 py-2.5 rounded-xl my-px transition-colors active:scale-[0.99]', (item as any).danger ? '' : 'hover:bg-stone-100 dark:hover:!bg-zinc-800', (item as any).active ? '!bg-[#EEF0FF] dark:!bg-violet-400/15' : '']">
        <span :class="['w-9 h-9 rounded-xl grid place-items-center text-sm shrink-0', chip[(item as any).accent] || chip.slate]"><i :class="(item as any).icon" /></span>
        <span :class="['text-sm flex-1 font-semibold', (item as any).danger ? 'text-red-600 dark:!text-red-400' : (item as any).active ? '!text-[#4338CA] dark:!text-white' : 'text-stone-700 dark:!text-zinc-100']">{{ (item as any).label }}</span>
        <i v-if="!(item as any).danger" class="pi pi-angle-right text-[10px] text-stone-300 dark:!text-zinc-600" />
      </a>
    </template>
  </Menu>
</template>
