<script setup>
defineProps({ value: String })
</script>
<template>
  <label class="block text-[13px] font-semibold tracking-tight text-ink-900">
    <span v-if="value">{{ value }}</span><span v-else><slot /></span>
  </label>
</template>
