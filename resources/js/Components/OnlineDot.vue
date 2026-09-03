<script setup lang="ts">
defineProps<{ online: boolean; size?: string }>()
</script>
<template>
  <span
    :class="[
      'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white dark:border-zinc-900 grid place-items-center',
      online ? 'bg-emerald-500' : 'bg-red-500',
      size || 'w-3.5 h-3.5',
    ]"
  >
    <span v-if="online" class="w-full h-full rounded-full bg-emerald-500 animate-ping absolute opacity-30"></span>
    <span v-if="online" class="w-1.5 h-1.5 bg-white rounded-full relative"></span>
    <span v-else class="w-1.5 h-1.5 bg-white rounded-full relative"></span>
  </span>
</template>
