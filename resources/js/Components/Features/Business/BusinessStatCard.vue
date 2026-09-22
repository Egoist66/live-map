<script setup lang="ts">
defineProps<{
  label: string
  value: number | string
  icon: string
}>()
</script>

<template>
  <div class="rounded-[20px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm flex items-center gap-3 min-w-0">
    <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white grid place-items-center shrink-0">
      <i :class="[icon, 'text-lg']" />
    </span>
    <span class="min-w-0">
      <span class="block text-2xl font-black tracking-tight dark:text-white leading-none">{{ value }}</span>
      <span class="block text-xs font-medium text-stone-500 dark:text-zinc-400 mt-1 truncate">{{ label }}</span>
    </span>
  </div>
</template>
