<script setup lang="ts">
import Button from 'primevue/button'
defineProps<{ disabled?: boolean; type?: string }>()
</script>
<template>
  <Button :disabled="disabled" :type="($props.type as any) || 'button'" severity="danger" v-bind="$attrs" class="!rounded-full !px-5 !py-2.5 !text-sm !font-semibold !shadow-soft">
    <slot />
  </Button>
</template>
