<script setup lang="ts">
import { nextTick, ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { avatarSrcFor } from '@/composables/useAvatar'

const props = defineProps<{
  visible: boolean
  title: string
  draft: string
  placeholder?: string
  sending: boolean
  mentions: any
  liftStyle?: Record<string, string>
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'update:draft', v: string): void
  (e: 'draftInput', cursor: number): void
  (e: 'pickMention', u: any): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

const draftInput = ref<any>(null)

function resolveTag(el: any): HTMLTextAreaElement | null {
  if (!el) {
    return null
  }
  if (el.tagName === 'TEXTAREA') {
    return el
  }
  try {
    return el.querySelector?.('textarea') ?? null
  } catch {
    return null
  }
}

function onInput(e: Event) {
  const el = e.target as HTMLTextAreaElement | null
  emit('update:draft', el?.value ?? '')
  emit('draftInput', typeof el?.selectionStart === 'number' ? el.selectionStart : (props.draft || '').length)
}

/**
 * Фокус в поле ввода (для подстановки упоминания).
 * @param cursor позиция курсора
 */
function focusInput(cursor?: number): void {
  nextTick(() => {
    try {
      const el = resolveTag((draftInput.value as any)?.$el ?? draftInput.value)
      el?.focus({ preventScroll: true } as any)
      if (typeof cursor === 'number') {
        try {
          el?.setSelectionRange?.(cursor, cursor)
        } catch {}
      }
    } catch {}
  })
}

function onShow(): void {
  focusInput((props.draft || '').length)
}

function onSubmit(): void {
  if (!props.draft.trim() || props.sending) {
    return
  }
  emit('submit')
}

defineExpose({ focusInput })
</script>
<template>
  <Dialog
    :visible="visible"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    @show="onShow"
    modal
    position="center"
    :dismissable-mask="true"
    :draggable="false"
    :closable="false"
    :style="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-zinc-700 overflow-visible', style: liftStyle }, content: { class: '!p-0 !bg-white dark:!bg-zinc-900 overflow-visible' } }"
  >
    <div class="px-5 pt-5 pb-4">
      <div class="text-[15px] font-black dark:text-white leading-tight">{{ title }}</div>
      <div class="relative mt-3">
        <Textarea
          ref="draftInput"
          :model-value="draft"
          @update:model-value="(v: string) => emit('update:draft', v)"
          @input="onInput"
          rows="4"
          autoResize
          maxlength="1000"
          enterkeyhint="send"
          autocomplete="off"
          autocapitalize="sentences"
          :placeholder="placeholder || 'Написать комментарий…'"
          class="w-full !rounded-2xl !text-[15px] max-h-44"
          :disabled="sending"
        />
        <div v-if="mentions?.mentionOpen?.value" class="absolute left-0 right-0 bottom-[calc(100%+8px)] bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-float overflow-hidden z-30 max-h-56 overflow-y-auto">
          <div v-if="mentions.mentionLoading.value" class="px-4 py-3 text-xs text-stone-400">Ищем людей…</div>
          <template v-else>
            <button v-for="u in mentions.mentionResults.value" :key="u.id" type="button" @click="emit('pickMention', u)" class="w-full flex items-center gap-2.5 px-3 py-2 active:bg-violet-100 transition text-left">
              <img :src="avatarSrcFor(u) || undefined" class="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
              <span class="min-w-0"><span class="block text-[13px] font-bold truncate dark:text-zinc-100">@{{ u.name }}</span></span>
            </button>
            <div v-if="!mentions.mentionResults.value.length" class="px-4 py-3 text-xs text-stone-400">Никого не нашли</div>
          </template>
        </div>
      </div>
      <div class="mt-3 flex gap-2">
        <Button label="Отмена" severity="secondary" outlined rounded class="flex-1" :disabled="sending" @click="emit('cancel')" />
        <Button label="Отправить" icon="pi pi-send" rounded class="flex-1 !bg-stone-900 dark:!bg-white dark:!text-ink-900 !border-stone-900 dark:!border-white" :loading="sending" :disabled="!draft.trim()" @click="onSubmit" />
      </div>
    </div>
  </Dialog>
</template>
