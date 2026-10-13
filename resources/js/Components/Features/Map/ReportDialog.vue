<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import { REPORT_REASONS } from '@/composables/useReportDialog'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

defineProps<{ dialog: any }>()
const { selectPt } = useDropdownMenuStyle()
</script>
<template>
  <Dialog
    :visible="dialog.open.value"
    @update:visible="(v:boolean)=>{ if(!v) dialog.close() }"
    modal
    header="Пожаловаться"
    :style="{ width: '420px', maxWidth: '94vw' }"
    :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none' } }"
  >
    <div class="space-y-3">
      <p v-if="dialog.targetTitle.value" class="text-sm text-stone-600 dark:text-zinc-300 truncate">
        «{{ dialog.targetTitle.value }}»
      </p>
      <div>
        <label class="text-xs font-semibold text-stone-500">Причина</label>
        <Select
          v-model="dialog.reason.value"
          :options="[...REPORT_REASONS]"
          option-label="l"
          option-value="v"
          class="w-full mt-1"
          :pt="selectPt"
        />
      </div>
      <div>
        <label class="text-xs font-semibold text-stone-500">Описание (что именно не так?)</label>
        <Textarea
          v-model="dialog.description.value"
          rows="4"
          maxlength="1000"
          auto-resize
          placeholder="Опиши нарушение подробно — это ускорит проверку…"
          class="w-full mt-1 !rounded-2xl"
        />
        <div class="text-[11px] text-stone-400 text-right mt-0.5">{{ dialog.description.value.length }}/1000</div>
      </div>
      <Message severity="info" :closable="false" class="!rounded-2xl !text-xs">
        {{ dialog.targetType.value === 'user' ? 'Жалоба уйдёт модераторам и снизит репутацию человека.' : 'Жалоба уйдёт модераторам. После 3 жалоб пин автоматически скрывается до проверки.' }}
      </Message>
    </div>
    <template #footer>
      <Button label="Отмена" text @click="dialog.close()" :disabled="dialog.sending.value" />
      <Button label="Отправить жалобу" severity="danger" :loading="dialog.sending.value" @click="dialog.submit()" />
    </template>
  </Dialog>
</template>
