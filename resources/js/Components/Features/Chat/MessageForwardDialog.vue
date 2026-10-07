<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Avatar from 'primevue/avatar'
import Skeleton from 'primevue/skeleton'
import { avatarSrcFor } from '@/composables/useAvatar'

defineProps<{ open: boolean; conversations: any[]; currentId: number | null; count: number; sending: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', id: number): void }>()

/**
 * Подпись строки: район, имя собеседника или номер чата.
 *
 * @param c диалог
 */
function rowLabel(c: any): string {
  const title = String(c?.title || '').trim()

  if (title !== '') {
    return title
  }

  const name = String(c?.other?.name || '').trim()

  if (name !== '') {
    return name
  }

  return `Чат №${c?.id}`
}
</script>

<template>
  <Dialog
    :visible="open"
    @update:visible="(v: boolean) => { if (!v) emit('close') }"
    modal
    header="Переслать"
    :draggable="false"
    :style="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{ root: { class: '!rounded-3xl' }, header: { class: '!py-3 !px-4' }, content: { class: '!px-2 !pb-2 !pt-0' } }"
  >
    <p class="px-3 pb-2 text-xs text-stone-500 dark:text-zinc-400">Выбрано: {{ count }} · куда переслать?</p>
    <div v-if="sending" class="space-y-1.5 px-1">
      <Skeleton v-for="n in 4" :key="n" height="3.5rem" borderRadius="1rem" />
    </div>
    <div v-else-if="!conversations.length" class="px-3 py-6 text-center text-sm text-stone-500">Нет диалогов для пересылки</div>
    <div v-else class="max-h-[50dvh] overflow-y-auto overscroll-contain">
      <button
        v-for="c in conversations"
        :key="c?.id"
        type="button"
        :disabled="sending"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-stone-50 dark:hover:bg-white/5 active:scale-[0.99] transition text-left disabled:opacity-60 min-w-0"
        @click="emit('pick', Number(c?.id))"
      >
        <span class="relative shrink-0">
          <span v-if="c?.title" class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-700 to-purple-900 text-white grid place-items-center">🏘️</span>
          <Avatar v-else :image="avatarSrcFor(c?.other)" shape="circle" class="!w-10 !h-10 [&_img]:object-cover" />
        </span>
        <span class="flex-1 min-w-0">
          <span class="flex items-center gap-1.5 text-sm font-semibold dark:text-white truncate">
            {{ rowLabel(c) }}
            <i v-if="c?.is_pinned" class="pi pi-thumbtack text-[10px] text-violet-500 shrink-0"></i>
          </span>
          <span v-if="Number(c?.id) === Number(currentId)" class="block text-[11px] text-stone-400">Этот чат</span>
        </span>
        <i class="pi pi-chevron-right text-xs text-stone-300 dark:text-zinc-600 shrink-0"></i>
      </button>
    </div>
  </Dialog>
</template>
