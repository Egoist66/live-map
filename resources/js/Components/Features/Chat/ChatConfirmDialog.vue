<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

defineProps<{ confirm: any }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'ok'): void }>()
</script>
<template>
  <Dialog :visible="!!confirm" @update:visible="(v:boolean)=>{ if(!v) emit('close') }" modal :closable="true" :draggable="false" :style="{ width: '360px', maxWidth: 'calc(100vw - 2rem)' }" :pt="{ header: { class: '!pb-2' }, content: { class: '!pt-0' } }">
    <template #header>
      <div class="flex items-center gap-3">
        <span class="w-9 h-9 rounded-full grid place-items-center text-lg shrink-0" :class="confirm?.severity === 'danger' ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'">{{ confirm?.icon }}</span>
        <span class="font-bold text-[15px]">{{ confirm?.title }}</span>
      </div>
    </template>
    <p class="text-sm text-stone-600 leading-relaxed">{{ confirm?.msg }}</p>
    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button label="Отмена" severity="secondary" text @click="emit('close')" />
        <Button :label="confirm?.confirmLabel" :severity="confirm?.severity" @click="emit('ok')" />
      </div>
    </template>
  </Dialog>
</template>
