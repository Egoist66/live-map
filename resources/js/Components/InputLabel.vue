<script setup lang="ts">
import { useAttrs } from 'vue'
defineProps<{ value?: string; for?: string }>()
</script>
<template>
  <label :for="$props.for" class="block text-[13px] font-semibold tracking-tight text-ink-900 dark:text-white">
    <span v-if="value">{{ value }}</span><span v-else><slot /></span>
  </label>
</template>
