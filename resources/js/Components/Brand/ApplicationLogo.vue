<script setup lang="ts">
import BrandMark from './BrandMark.vue'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>
<template>
  <div class="flex items-center gap-2">
    <span class="grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] shadow-soft shrink-0 min-[411px]:h-9 min-[411px]:w-9 min-[411px]:rounded-xl">
      <BrandMark class="h-full w-full" />
    </span>
    <span v-if="!compact" class="font-black tracking-[-0.03em] text-[17px] min-[411px]:text-[19px] text-ink-900 whitespace-nowrap">U<span class="font-light text-ink-600">Pin</span></span>
  </div>
</template>
