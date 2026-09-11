<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <Dialog :visible="visible" modal header="Удалить пост?" :style="{ width: '380px', maxWidth: '92vw' }" @update:visible="(v:boolean) => { if (!v) emit('cancel') }">
    <p class="text-sm text-stone-500">Пост и все комментарии будут удалены без возможности восстановления.</p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="Отмена" text severity="secondary" @click="emit('cancel')" />
        <Button label="Удалить" severity="danger" @click="emit('confirm')" />
      </div>
    </template>
  </Dialog>
</template>
