<script setup lang="ts">
import Dialog from 'primevue/dialog'
import DatingQuestionnaireForm from '@/Components/Features/Dating/DatingQuestionnaireForm.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'saved', saved?: Record<string, any>): void }>()

/**
 * Закрыть модалку после сохранения анкеты.
 *
 * @param saved свежие dating_* поля из формы
 */
function onSaved(saved?: Record<string, any>): void {
  emit('saved', saved)
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :visible="open"
    @update:visible="(v:boolean)=>emit('update:open', v)"
    modal
    header="Моя анкета ULove"
    :style="{ width: '640px', maxWidth: '94vw', maxHeight: '92dvh' }"
    :pt="{ root: { class: '!rounded-3xl max-sm:!rounded-b-none dark:!bg-[#0F121F] dark:!border-white/10' }, header: { class: 'dark:!bg-[#0F121F] dark:!text-white' }, content: { class: 'dark:!bg-[#0F121F] dark:!text-zinc-100 !max-h-[78dvh] !overflow-y-auto' } }"
  >
    <DatingQuestionnaireForm :key="String(open)" @saved="onSaved()" />
  </Dialog>
</template>
