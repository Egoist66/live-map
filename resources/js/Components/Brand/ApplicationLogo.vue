<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>
<template>
  <div class="flex items-center gap-2">
    <span class="grid h-8 w-8 place-items-center rounded-[10px] bg-ink-900 text-white shadow-soft relative overflow-hidden shrink-0 min-[411px]:h-9 min-[411px]:w-9 min-[411px]:rounded-xl">
      <span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-accent-teal opacity-90"></span>
      <span class="relative text-[12px] min-[411px]:text-[13px] font-black tracking-tighter">◉</span>
    </span>
    <span v-if="!compact" class="font-black tracking-[-0.03em] text-[17px] min-[411px]:text-[19px] text-ink-900 whitespace-nowrap">U<span class="font-light text-ink-600">Pin</span></span>
  </div>
</template>
