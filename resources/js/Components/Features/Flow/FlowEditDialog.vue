<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useFlowComposer } from '@/composables/useFlowComposer'

const props = defineProps<{ composer: ReturnType<typeof useFlowComposer> }>()
const visible = defineModel<boolean>('visible', { default: false })

/**
 * Сохранить и закрыть диалог при успехе.
 */
async function save(): Promise<void> {
  const ok = await props.composer.submit()
  if (ok) visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Редактировать пост"
    :dismissable-mask="true"
    :block-scroll="true"
    :pt="{
      root: { class: '!m-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-[100vw] !rounded-none !border-0' },
      header: { class: '!px-4 !py-3 sm:!px-6' },
      content: { class: '!px-4 sm:!px-6 !pb-4 !h-full' },
      footer: { class: '!px-4 sm:!px-6 !py-3' },
    }"
    @hide="props.composer.reset()"
  >
    <div class="mx-auto flex h-full w-full max-w-[720px] flex-col gap-3">
      <div>
        <InputText
          v-model="props.composer.title.value"
          placeholder="Заголовок (необязательно)"
          :maxlength="props.composer.MAX_TITLE"
          class="w-full !rounded-2xl !text-base !font-bold"
        />
        <div class="mt-1 text-right text-xs tabular-nums text-stone-400">{{ props.composer.titleLeft.value }}</div>
      </div>
      <Textarea
        v-model="props.composer.body.value"
        placeholder="Текст новости…"
        rows="14"
        auto-resize
        class="w-full flex-1 !rounded-2xl !bg-stone-100 dark:!bg-zinc-800 !border-0 !text-[15px] !leading-relaxed"
      />
      <div class="flex items-center justify-between gap-3">
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-500 dark:text-zinc-400">
          <Checkbox v-model="props.composer.isAnonymous.value" binary input-id="flow-edit-anon" />
          <span>Анонимно</span>
        </label>
        <span class="text-xs tabular-nums" :class="props.composer.bodyLeft.value < 0 ? 'text-red-500 font-bold' : 'text-stone-400'">
          {{ props.composer.bodyLeft.value }}
        </span>
      </div>
    </div>
    <template #footer>
      <div class="mx-auto flex w-full max-w-[720px] justify-end gap-2">
        <Button label="Отмена" text severity="secondary" @click="visible = false" />
        <Button label="Сохранить" icon="pi pi-check" :loading="props.composer.saving.value" :disabled="!props.composer.canSubmit.value" @click="save()" />
      </div>
    </template>
  </Dialog>
</template>
