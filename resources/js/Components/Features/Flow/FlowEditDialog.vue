<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
// Swiper-превью/карусель — тяжёлые, диалог открывается редко: грузим лениво.
const FlowComposerPreview = defineAsyncComponent(() => import('@/Components/Features/Flow/FlowComposerPreview.vue'))
const FlowMediaCarousel = defineAsyncComponent(() => import('@/Components/Features/Flow/FlowMediaCarousel.vue'))
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
 * Подставить выбранные фото в композер (набор заменит серверный).
 * @param e событие input file
 */
function onPhoto(e: Event): void {
  const input = e.target as HTMLInputElement
  void props.composer.pickImages(input.files)
  input.value = ''
}

/**
 * Подставить выбранное видео в композер (заменит серверный набор).
 * @param e событие input file
 */
function onVideo(e: Event): void {
  const input = e.target as HTMLInputElement
  props.composer.pickVideo(input.files?.[0] ?? null)
  input.value = ''
}
</script>

<template>
  <!-- dialog-fullscreen/dialog-fullscreen-mask: opt-out из мобильного bottom-sheet,
       реальный размер задаёт app.css (бьёт глобальные !important), здесь только маркеры. -->
  <Dialog
    v-model:visible="visible"
    modal
    header="Редактировать пост"
    :dismissable-mask="true"
    :draggable="false"
    :block-scroll="true"
    :pt="{
      root: { class: 'dialog-fullscreen' },
      mask: { class: 'dialog-fullscreen-mask' },
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
      <FlowComposerPreview
        v-if="props.composer.imagePreviews.value.length"
        :previews="props.composer.imagePreviews.value"
        @remove="props.composer.removeImageAt($event)"
      />
      <FlowMediaCarousel
        v-else-if="props.composer.existingMedia.value.length && !props.composer.removeMedia.value"
        :media="props.composer.existingMedia.value"
      />
      <div v-if="props.composer.videoPreview.value" class="relative overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-700">
        <video :src="props.composer.videoPreview.value" controls preload="metadata" playsinline class="max-h-72 w-full bg-black" />
        <Button icon="pi pi-times" rounded severity="danger" aria-label="Убрать видео" class="!absolute !top-2 !right-2 !w-9 !h-9" @click="props.composer.pickVideo(null)" />
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white">
          <i class="pi pi-image" />
          <span>{{ props.composer.imagePreviews.value.length ? `Фото ${props.composer.imagePreviews.value.length}/${props.composer.MAX_PHOTOS}` : (props.composer.existingMedia.value.length ? 'Заменить фото' : 'Фото') }}</span>
          <input type="file" accept="image/*" multiple class="hidden" @change="onPhoto" />
        </label>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white" title="Видео до 50 МБ (mp4, webm, mov)">
          <i class="pi pi-video" />
          <span>Видео</span>
          <input type="file" accept="video/mp4,video/webm,video/quicktime,video/3gpp" class="hidden" @change="onVideo" />
        </label>
        <button
          v-if="props.composer.existingMedia.value.length && !props.composer.removeMedia.value && !props.composer.imagePreviews.value.length && !props.composer.videoPreview.value"
          type="button"
          class="inline-flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600"
          @click="props.composer.dropExistingMedia()"
        >
          <i class="pi pi-trash" />
          <span>Убрать всё</span>
        </button>
        <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-500 dark:text-zinc-400">
          <Checkbox v-model="props.composer.isAnonymous.value" binary input-id="flow-edit-anon" />
          <span>Анонимно</span>
        </label>
        <span class="ml-auto text-xs tabular-nums" :class="props.composer.bodyLeft.value < 0 ? 'text-red-500 font-bold' : 'text-stone-400'">
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
