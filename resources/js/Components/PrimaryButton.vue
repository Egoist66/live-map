<script setup lang="ts">
import Button from 'primevue/button'
defineProps<{ disabled?: boolean; type?: string }>()
</script>
<template>
  <Button :disabled="disabled" :type="($props.type as any) || 'button'" v-bind="$attrs" class="!rounded-full !bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-ink-900 dark:!border-white !px-6 !py-2.5 !text-sm !font-semibold !shadow-soft hover:!opacity-90">
    <slot />
  </Button>
</template>
