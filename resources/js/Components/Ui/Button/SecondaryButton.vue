<script setup lang="ts">
import Button from 'primevue/button'
defineProps<{ disabled?: boolean; type?: string }>()
</script>
<template>
  <Button :disabled="disabled" :type="($props.type as any) || 'button'" severity="secondary" outlined v-bind="$attrs" class="!rounded-full !bg-white dark:!bg-white/[0.06] !border-stone-200 dark:!border-white/10 !text-ink-900 dark:!text-white !px-5 !py-2.5 !text-sm !font-semibold hover:!bg-stone-50 dark:hover:!bg-white/15">
    <slot />
  </Button>
</template>
