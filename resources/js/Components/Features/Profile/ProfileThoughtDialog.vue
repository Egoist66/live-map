<script setup lang="ts">
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { THOUGHT_MAX_LENGTH } from '@/composables/useProfileThought'

defineProps<{
  open: boolean
  draft: string
  saving: boolean
  error: string | null
}>()

const emit = defineEmits<{
  (e: 'update:draft', value: string): void
  (e: 'close'): void
  (e: 'save'): void
}>()
</script>

<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>{ if(!v) emit('close') }" modal dismissableMask :closable="true" :draggable="false" header="Мысль профиля" :style="{ width: '360px', maxWidth: 'calc(100vw - 2rem)' }">
    <div class="flex flex-col gap-2">
      <InputText
        :model-value="draft"
        @update:model-value="emit('update:draft', String($event ?? ''))"
        placeholder="Короткая мысль…"
        :maxlength="THOUGHT_MAX_LENGTH"
        autofocus
        fluid
        @keydown.enter="emit('save')"
      />
      <div class="flex items-center justify-between">
        <span v-if="error" class="text-xs text-red-500">{{ error }}</span>
        <span v-else class="text-xs text-stone-400">Одна строка под именем, без соцсетей и ников</span>
        <span class="text-xs text-stone-400">{{ draft.length }}/{{ THOUGHT_MAX_LENGTH }}</span>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="Отмена" severity="secondary" text :disabled="saving" @click="emit('close')" />
        <Button label="Сохранить" :loading="saving" rounded class="!border-0 !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !text-sm !font-bold !text-white" @click="emit('save')" />
      </div>
    </template>
  </Dialog>
</template>
