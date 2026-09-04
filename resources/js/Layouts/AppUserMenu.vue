<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Menu from 'primevue/menu'

defineProps<{ user: any; avatarSrc: string; items: any[] }>()
defineExpose({})
const menuRef = defineModel<any>('menuRef')
</script>
<template>
  <Menu ref="menuRef" :model="items" popup class="!min-w-[260px] !bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-2xl !shadow-xl overflow-hidden" :pt="{ root: { class: '!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-2xl shadow-xl' }, list: { class: '!bg-white dark:!bg-zinc-900 !p-1' }, item: { class: '!bg-transparent' } }">
    <template #item="{ item, props }">
      <div v-if="(item as any).isHeader" class="px-4 py-3 flex gap-3 border-b border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50">
        <Avatar :image="avatarSrc" shape="circle" size="large" class="!w-9 !h-9" />
        <div class="min-w-0"><div class="text-sm font-semibold truncate text-ink-900 dark:text-white">{{ user?.name }}</div><div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ user?.email }}</div></div>
      </div>
      <a v-else-if="(item as any).separator" class="my-1 border-t border-stone-200 dark:border-zinc-700 block" />
      <a v-else v-bind="props.action" class="flex items-center gap-2 px-3 py-2.5 rounded-xl mx-1 my-0.5 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-200 transition">
        <i :class="(item as any).icon + ' text-stone-500 dark:text-zinc-400'" /><span class="text-sm flex-1 font-medium">{{ (item as any).label }}</span>
      </a>
    </template>
  </Menu>
</template>
