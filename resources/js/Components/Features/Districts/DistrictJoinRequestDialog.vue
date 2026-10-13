<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    districtName: string
    message: string
    sending: boolean
    isBusiness?: boolean
  }>(),
  { isBusiness: false },
)

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'update:message', v: string): void
  (e: 'submit'): void
}>()

const clean = computed(() => props.message.trim())
/** Организациям цель обязательна (минимум 10 символов), персонам — по желанию. */
const required = computed(() => props.isBusiness)
const canSubmit = computed(() => !props.sending && (!required.value || clean.value.length >= 10))
const counter = computed(() => `${clean.value.length}/500`)
</script>

<template>
  <Dialog
    :visible="open"
    @update:visible="(v: boolean) => emit('update:open', v)"
    modal
    :header="`Заявка в «${districtName}»`"
    :style="{ width: '440px', maxWidth: '94vw' }"
    :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden' } }"
  >
    <div class="space-y-3">
      <Message v-if="isBusiness" severity="info" :closable="false" class="!rounded-2xl !text-xs">
        Вы вступаете как организация — владелец увидит цель и решит: принять, отклонить или связаться с вами.
      </Message>
      <div>
        <label class="text-[13px] font-bold dark:text-white">
          Цель вступления{{ required ? ' *' : '' }}
        </label>
        <p class="text-[12px] text-stone-500 dark:text-zinc-400 mt-0.5">
          {{ required ? 'Обязательно для организаций — минимум 10 символов.' : 'Необязательно — пара слов о себе.' }}
        </p>
        <Textarea
          :model-value="message"
          @update:model-value="(v: string | undefined) => emit('update:message', v ?? '')"
          rows="3"
          maxlength="500"
          fluid
          placeholder="Например: хотим рассказывать жителям о наших акциях и отвечать на вопросы…"
          class="mt-2 !rounded-2xl !text-sm"
        />
        <div class="mt-1 text-right text-[11px] text-stone-400">{{ counter }}</div>
      </div>
    </div>
    <template #footer>
      <Button label="Отмена" text @click="emit('update:open', false)" />
      <Button
        label="Отправить заявку"
        icon="pi pi-send"
        :loading="sending"
        :disabled="!canSubmit"
        class="!bg-blue-600 !border-blue-600"
        @click="emit('submit')"
      />
    </template>
  </Dialog>
</template>
