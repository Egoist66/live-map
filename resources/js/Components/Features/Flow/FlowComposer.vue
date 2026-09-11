<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useFlowComposer } from '@/composables/useFlowComposer'

const props = defineProps<{ compact?: boolean }>()
const composer = useFlowComposer()

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  composer.pickImage(input.files?.[0] ?? null)
  input.value = ''
}
</script>

<template>
  <Card class="!rounded-3xl !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-soft overflow-hidden">
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
              class="w-full !rounded-2xl !bg-stone-100 dark:!bg-zinc-800/70 !border-0 !text-[15px] !min-h-[7rem]"
            />
            <div v-if="composer.imagePreview.value" class="relative mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-700">
              <img :src="composer.imagePreview.value" alt="Превью" class="max-h-72 w-full object-cover" />
              <Button icon="pi pi-times" rounded severity="danger" class="!absolute !top-2 !right-2 !w-8 !h-8" @click="composer.clearImage()" />
            </div>
            <div class="mt-2 flex items-center gap-4">
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white">
                <i class="pi pi-image" />
                <span>Фото</span>
                <input type="file" accept="image/*" class="hidden" @change="onFile" />
              </label>
              <label class="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-500 dark:text-zinc-400">
                <Checkbox v-model="composer.isAnonymous.value" binary input-id="flow-anon" />
                <span>Анонимно</span>
              </label>
            </div>
            <div class="mt-1.5 text-xs text-stone-400">
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
