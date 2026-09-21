<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import { useChatAutoReply } from '@/composables/useChatAutoReply'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'saved', enabled: boolean): void }>()

const autoReply = useChatAutoReply()
const draftEnabled = ref(false)
const draftText = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void ensureLoaded()
    }
  },
)

async function ensureLoaded(): Promise<void> {
  if (!autoReply.loaded.value && !autoReply.loading.value) {
    await autoReply.load()
  }

  draftEnabled.value = autoReply.enabled.value
  draftText.value = autoReply.text.value
}

function close(): void {
  emit('update:open', false)
}

/**
 * Сохранить автоответ и уведомить страницу для тоста.
 */
async function save(): Promise<void> {
  const ok = await autoReply.save(draftEnabled.value, draftText.value)

  if (!ok) {
    return
  }

  emit('saved', autoReply.enabled.value)
  close()
}

function useDefault(): void {
  draftText.value = ''
}
</script>

<template>
  <Dialog
    :visible="props.open"
    @update:visible="(v: boolean) => emit('update:open', v)"
    modal
    dismissable-mask
    header="Автоответ"
    class="w-[min(480px,94vw)]"
    :pt="{ root: { class: '!rounded-3xl' } }"
  >
    <div class="flex flex-col gap-3 min-w-0">
      <div v-if="autoReply.loading.value" class="flex justify-center py-6">
        <span class="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></span>
      </div>
      <template v-else>
        <div class="flex items-center justify-between gap-3 bg-stone-50 dark:bg-zinc-800/70 border border-stone-100 dark:border-zinc-700/60 rounded-2xl px-3 py-2.5">
          <div class="min-w-0">
            <div class="text-sm font-bold dark:text-white">Отвечать, когда я не онлайн</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400">Собеседник получит сообщение, а тебе придёт пинг на email</div>
          </div>
          <ToggleSwitch v-model="draftEnabled" input-id="chat-autoreply" class="shrink-0" />
        </div>

        <div v-if="!autoReply.hasEmail.value" class="text-xs">
          <Message severity="warn" class="w-full !rounded-2xl !text-xs">
            В аккаунте нет email — письмо-пинг некуда отправлять. Автоответ собеседнику всё равно будет работать.
          </Message>
        </div>

        <div class="min-w-0">
          <label for="chat-autoreply-text" class="block text-xs font-bold text-stone-500 dark:text-zinc-400 mb-1.5">
            Свой текст (необязательно, макс. 500)
          </label>
          <Textarea
            id="chat-autoreply-text"
            v-model="draftText"
            rows="3"
            auto-resize
            maxlength="500"
            placeholder="Пусто = дефолтное: «Я пока не онлайн, пообщаемся позже…»"
            fluid
            class="w-full !rounded-2xl text-sm"
          />
          <div class="flex items-center justify-between mt-1.5 gap-2">
            <button @click="useDefault" class="text-xs font-bold text-violet-600 dark:text-violet-300 hover:underline shrink-0">
              Использовать дефолтный
            </button>
            <span class="text-[11px] text-stone-400 tabular-nums shrink-0">{{ draftText.trim().length }}/500</span>
          </div>
        </div>

        <div class="bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-800/50 rounded-2xl px-3 py-2.5 text-xs leading-relaxed text-stone-600 dark:text-zinc-300">
          <div class="font-bold text-violet-700 dark:text-violet-300 mb-0.5">Как это работает</div>
          <div>Пока тебя нет в сети дольше 3 минут, человек в личном диалоге получит:</div>
          <div class="mt-1 italic">«{{ draftText.trim() === '' ? (autoReply.defaultText.value || 'Я пока не онлайн…') : draftText.trim() }}»</div>
          <div class="mt-1">А на твой email упадёт письмо со ссылкой на чат. Не чаще раза в час на диалог — от спама защищено.</div>
        </div>

        <div v-if="autoReply.error.value" class="text-xs text-red-600 dark:text-red-400">{{ autoReply.error.value }}</div>

        <div class="flex gap-2 justify-end">
          <Button label="Отмена" text severity="secondary" @click="close" class="!rounded-full" />
          <Button label="Сохранить" icon="pi pi-check" :loading="autoReply.saving.value" @click="save" class="!rounded-full" />
        </div>
      </template>
    </div>
  </Dialog>
</template>
