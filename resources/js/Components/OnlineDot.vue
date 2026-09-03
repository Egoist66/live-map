<script setup lang="ts">
defineProps<{ online: boolean; size?: string }>()
</script>
<template>
  <span
    :class="[
      'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white dark:border-zinc-900 grid place-items-center',
      online ? 'bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]' : 'bg-red-500 animate-[pulse_2.8s_ease-in-out_infinite]',
      size || 'w-3.5 h-3.5',
    ]"
  >
    <span class="w-1.5 h-1.5 bg-white rounded-full relative animate-pulse"></span>
  </span>
</template>
