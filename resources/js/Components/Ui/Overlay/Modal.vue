<script setup lang="ts">
import Dialog from 'primevue/dialog'
const props = defineProps<{ show: boolean; maxWidth?: string; closeable?: boolean }>()
const emit = defineEmits(['close'])
</script>
<template>
  <Dialog :visible="props.show" @update:visible="(v:boolean)=>{ if(!v) emit('close') }" modal :closable="props.closeable ?? true" :draggable="false" :style="{ width: props.maxWidth==='sm'?'380px':props.maxWidth==='md'?'440px':props.maxWidth==='lg'?'560px':props.maxWidth==='xl'?'640px':'640px', maxWidth:'calc(100vw - 2rem)' }" :pt="{ root:{ class:'!rounded-3xl !border-stone-200 dark:!border-zinc-700 !shadow-float' }, header:{ class:'!p-6 !pb-0' }, content:{ class:'!p-0' } }">
    <slot />
  </Dialog>
</template>
