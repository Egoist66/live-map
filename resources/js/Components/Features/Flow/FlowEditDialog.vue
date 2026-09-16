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

/**
 * Подставить выбранный файл в композер.
 * @param e событие input file
 */
function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  props.composer.pickImage(input.files?.[0] ?? null)
  input.value = ''
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Редактировать пост"
    :dismissable-mask="true"
    :draggable="false"
    :block-scroll="true"
    :style="{ width: '100vw', maxWidth: '100vw', height: '100dvh', maxHeight: '100dvh', margin: '0', borderRadius: '0', border: '0' }"
    :pt="{
      root: { class: '!m-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-[100vw] !rounded-none !border-0' },
      mask: { class: '!p-0 !items-stretch !justify-center' },
      header: { class: '!px-4 !py-3 sm:!px-6' },
      content: { class: '!px-4 sm:!px-6 !pb-4 !h-full !max-h-full !overflow-y-auto' },
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
      <div v-if="props.composer.imagePreview.value" class="relative overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-700">
        <img :src="props.composer.imagePreview.value" alt="Картинка поста" class="max-h-72 w-full object-cover" />
        <Button icon="pi pi-times" rounded severity="danger" aria-label="Убрать картинку" class="!absolute !top-2 !right-2 !w-9 !h-9" @click="props.composer.clearImage()" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-4">
          <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white">
            <i class="pi pi-image" />
            <span>{{ props.composer.imagePreview.value ? 'Заменить' : 'Фото' }}</span>
            <input type="file" accept="image/*" class="hidden" @change="onFile" />
          </label>
          <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-500 dark:text-zinc-400">
            <Checkbox v-model="props.composer.isAnonymous.value" binary input-id="flow-edit-anon" />
            <span>Анонимно</span>
          </label>
        </div>
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
