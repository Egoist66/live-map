<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
// Превью на swiper нужно только при аттаче фото — грузим лениво.
const FlowComposerPreview = defineAsyncComponent(() => import('@/Components/Features/Flow/FlowComposerPreview.vue'))
import { useFlowComposer, POLL_DURATION_OPTIONS } from '@/composables/useFlowComposer'

const props = defineProps<{ compact?: boolean }>()
const composer = useFlowComposer()

function onPhoto(e: Event) {
  const input = e.target as HTMLInputElement
  void composer.pickImages(input.files)
  input.value = ''
}

function onVideo(e: Event) {
  const input = e.target as HTMLInputElement
  composer.pickVideo(input.files?.[0] ?? null)
  input.value = ''
}
</script>

<template>
  <Card class="!rounded-3xl !border-stone-200 dark:!border-white/10 !bg-white dark:!bg-[#0F121F] !shadow-soft overflow-hidden">
    <template #content>
      <div class="p-3 sm:p-5">
        <div class="flex-1 min-w-0">
            <InputText
              v-model="composer.title.value"
              placeholder="Заголовок (необязательно)"
              maxlength="150"
              class="w-full !rounded-2xl !mb-2 !text-[15px] !font-bold"
            />
            <Textarea
              v-model="composer.body.value"
              rows="4"
              auto-resize
              placeholder="Что нового? Поделитесь новостью…"
              class="w-full !rounded-2xl !bg-stone-100 dark:!bg-white/[0.06] !border-0 !text-[15px] !min-h-[7rem]"
            />
            <FlowComposerPreview :previews="composer.imagePreviews.value" @remove="composer.removeImageAt($event)" />
            <div v-if="composer.videoPreview.value" class="relative mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-white/10">
              <video :src="composer.videoPreview.value" controls preload="metadata" playsinline class="max-h-72 w-full bg-black" />
              <Button icon="pi pi-times" rounded severity="danger" class="!absolute !top-2 !right-2 !w-8 !h-8" @click="composer.pickVideo(null)" />
            </div>
            <div v-if="composer.pollEnabled.value" class="mt-3 rounded-2xl border border-stone-200 dark:border-white/10 p-3">
              <div class="flex items-center gap-2 text-sm font-bold dark:text-white">
                <i class="pi pi-chart-bar text-violet-500" />Опрос
                <span class="flex-1" />
                <Button icon="pi pi-times" text rounded severity="secondary" class="!w-7 !h-7" @click="composer.pollEnabled.value = false" aria-label="Убрать опрос" />
              </div>
              <div class="mt-2 space-y-1.5">
                <div v-for="(_, i) in composer.pollOptions.value" :key="i" class="flex items-center gap-1.5">
                  <InputText v-model="composer.pollOptions.value[i]" :placeholder="`Вариант ${i + 1}`" maxlength="120" class="flex-1 !rounded-xl !text-sm" />
                  <Button v-if="composer.pollOptions.value.length > 2" icon="pi pi-times" text rounded severity="danger" class="!w-8 !h-8 shrink-0" @click="composer.removePollOption(i)" :aria-label="`Убрать вариант ${i + 1}`" />
                </div>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <Button v-if="composer.pollOptions.value.length < composer.MAX_POLL_OPTIONS" label="Вариант" icon="pi pi-plus" link size="small" class="!text-xs !p-0" @click="composer.addPollOption()" />
                <span class="flex-1" />
                <Select v-model="composer.pollCloses.value" :options="[...POLL_DURATION_OPTIONS]" option-label="label" option-value="value" class="!rounded-xl !text-xs" />
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white">
                <i class="pi pi-image" />
                <span>Фото{{ composer.imagePreviews.value.length ? ` ${composer.imagePreviews.value.length}/${composer.MAX_PHOTOS}` : '' }}</span>
                <input type="file" accept="image/*" multiple class="hidden" @change="onPhoto" />
              </label>
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white" title="Видео до 50 МБ (mp4, webm, mov)">
                <i class="pi pi-video" />
                <span>Видео</span>
                <input type="file" accept="video/mp4,video/webm,video/quicktime,video/3gpp" class="hidden" @change="onVideo" />
              </label>
              <button type="button" class="inline-flex items-center gap-2 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white" @click="composer.pollEnabled.value = !composer.pollEnabled.value">
                <i class="pi pi-chart-bar" />
                <span>Опрос</span>
              </button>
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-500 dark:text-zinc-400">
                <Checkbox v-model="composer.isAnonymous.value" binary input-id="flow-anon" />
                <span>Анонимно</span>
              </label>
            </div>
            <div class="mt-1.5 text-xs text-stone-400">
              Фото — до 4 шт · видео — до 50 МБ (mp4, webm, mov)
            </div>
            <div class="mt-1 text-xs text-stone-400">
              Анонимно: бесплатно — 2 поста, с <span class="font-semibold text-fuchsia-600">PRO</span> — 5
            </div>
        </div>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-xs tabular-nums self-end sm:self-auto" :class="composer.bodyLeft.value < 0 ? 'text-red-500 font-bold' : 'text-stone-400'">
            {{ composer.bodyLeft.value }}
          </span>
          <Button
            label="Опубликовать"
            icon="pi pi-send"
            rounded
            size="small"
            :loading="composer.saving.value"
            :disabled="!composer.canSubmit.value"
            class="w-full sm:w-auto !bg-ink-900 dark:!bg-white dark:!text-ink-900 !border-0"
            @click="composer.submit()"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
