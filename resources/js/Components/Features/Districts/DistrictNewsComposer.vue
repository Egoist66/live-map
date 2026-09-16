<script setup lang="ts">
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

defineProps<{
  title: string
  body: string
  bodyLeft: number
  imagePreview: string | null
  saving: boolean
  editing: boolean
  canSubmit: boolean
}>()

const emit = defineEmits<{
  (e: 'update:title', value: string): void
  (e: 'update:body', value: string): void
  (e: 'pick-image', file: File | null): void
  (e: 'clear-image'): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  emit('pick-image', input.files?.[0] ?? null)
  input.value = ''
}
</script>

<template>
  <Card class="!rounded-3xl !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-soft overflow-hidden">
    <template #content>
      <div class="p-3 sm:p-5">
        <div class="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500">
          {{ editing ? 'Правка новости' : 'Новость района' }}
        </div>
        <InputText
          :model-value="title"
          placeholder="Заголовок (необязательно)"
          maxlength="150"
          class="mt-2 w-full !rounded-2xl !text-[15px] !font-bold"
          @update:model-value="(v: string | undefined) => emit('update:title', v ?? '')"
        />
        <Textarea
          :model-value="body"
          rows="3"
          auto-resize
          placeholder="Что нового в районе? Расскажите жителям…"
          maxlength="2000"
          class="mt-2 w-full !rounded-2xl !border-0 !bg-stone-100 !text-[15px] dark:!bg-zinc-800/70"
          @update:model-value="(v: string | undefined) => emit('update:body', v ?? '')"
        />
        <div v-if="imagePreview" class="relative mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-700">
          <img :src="imagePreview" alt="Превью" class="max-h-72 w-full object-cover" />
          <Button icon="pi pi-times" rounded severity="danger" class="!absolute !right-2 !top-2 !h-8 !w-8" @click="emit('clear-image')" />
        </div>
        <div class="mt-2 flex items-center gap-4">
          <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-500 hover:text-ink-900 dark:text-zinc-400 dark:hover:text-white">
            <i class="pi pi-image" />
            <span>Фото</span>
            <input type="file" accept="image/*" class="hidden" @change="onFile" />
          </label>
          <span class="text-xs tabular-nums" :class="bodyLeft < 0 ? 'font-bold text-red-500' : 'text-stone-400'">
            {{ bodyLeft }}
          </span>
        </div>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            v-if="editing"
            label="Отмена"
            rounded
            outlined
            severity="secondary"
            class="flex-1"
            @click="emit('cancel')"
          />
          <Button
            :label="editing ? 'Сохранить' : 'Опубликовать'"
            icon="pi pi-send"
            rounded
            size="small"
            :loading="saving"
            :disabled="!canSubmit"
            class="flex-[1.4] !border-0 !bg-blue-600 !text-white hover:!bg-blue-500"
            @click="emit('submit')"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
