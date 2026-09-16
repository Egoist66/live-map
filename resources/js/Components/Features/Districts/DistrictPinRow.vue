<script setup lang="ts">
defineProps<{
  title: string
  category: string
  commentsCount: number
  dateLabel: string
}>()

const emit = defineEmits<{
  (e: 'open'): void
}>()
</script>

<template>
  <button type="button" class="flex w-full items-center gap-2.5 rounded-2xl border border-stone-200/70 bg-white p-2.5 text-left transition hover:border-blue-300 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-500/40" @click="emit('open')">
    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
      <i class="pi pi-map-marker text-sm" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-[13px] font-bold text-ink-900 dark:text-white">{{ title }}</span>
      <span class="block truncate text-[11px] text-stone-500 dark:text-zinc-400">{{ category }} · {{ commentsCount }} комм. · {{ dateLabel }}</span>
    </span>
    <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 dark:text-zinc-600" />
  </button>
</template>
