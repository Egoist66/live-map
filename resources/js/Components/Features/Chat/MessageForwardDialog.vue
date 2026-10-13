<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Avatar from 'primevue/avatar'
import ProgressSpinner from 'primevue/progressspinner'
import { avatarSrcFor } from '@/composables/useAvatar'

const props = defineProps<{
  open: boolean
  conversations: any[]
  currentId: number | null
  count: number
  sending: boolean
  targetId?: number | 'saved' | null
  sources?: any[]
}>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', id: number | 'saved'): void }>()

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

/**
 * Имя автора одного выбранного сообщения для превью.
 *
 * @param m сообщение из ленты (с полем sender, когда подгружено)
 */
function sourceAuthorName(m: any): string {
  const name = String(m?.sender?.name ?? m?.sender_name ?? '').trim()

  if (name !== '') {
    return name
  }

  return 'Пользователь'
}

/**
 * Уникальные авторы выбранных сообщений для превью «От кого пересылаем».
 */
const sourceAuthors = computed(() => {
  const seen: string[] = []

  for (const m of props.sources ?? []) {
    const name = sourceAuthorName(m)

    if (!seen.includes(name)) {
      seen.push(name)
    }

    if (seen.length >= 3) {
      break
    }
  }

  return seen
})
</script>

<template>
  <Dialog
    :visible="open"
    @update:visible="(v: boolean) => { if (!v) emit('close') }"
    modal
    header="Переслать"
    :draggable="false"
    :style="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{ root: { class: '!rounded-3xl max-sm:!rounded-b-none' }, header: { class: '!py-3 !px-4' }, content: { class: '!px-2 !pb-2 !pt-0' } }"
  >
    <p class="px-3 pb-2 text-xs text-stone-500 dark:text-zinc-400 flex items-center gap-2">
      <span>Выбрано: {{ count }} · куда переслать?</span>
      <span v-if="sending" class="inline-flex items-center gap-1.5 text-[#1786FF] font-semibold">
        <ProgressSpinner style="width: 14px; height: 14px" :stroke-width="7" aria-label="Пересылаем" />
        Пересылаем…
      </span>
    </p>
    <div v-if="(sources ?? []).length" class="mx-1 mb-2 flex items-center gap-2 rounded-2xl bg-stone-50 dark:bg-white/5 px-3 py-2 min-w-0">
      <span class="flex -space-x-1.5 shrink-0">
        <Avatar
          v-for="a in (sources ?? []).slice(0, 3)"
          :key="String(a?.sender_id ?? a?.id)"
          :image="avatarSrcFor(a?.sender ?? a?.forwarded_from ?? { name: a?.sender_name })"
          shape="circle"
          class="!w-6 !h-6 ring-2 ring-white dark:ring-zinc-900 [&_img]:object-cover"
        />
      </span>
      <span class="min-w-0 flex-1 truncate text-xs text-stone-500 dark:text-zinc-400">
        От: <span class="font-semibold text-stone-700 dark:text-zinc-200">{{ sourceAuthors.join(', ') || '…' }}</span>
      </span>
    </div>
    <div v-if="!conversations.length && !sending" class="px-3 py-6 text-center text-sm text-stone-500">Нет диалогов для пересылки</div>
    <div v-else class="max-h-[50dvh] overflow-y-auto overscroll-contain">
      <button
        type="button"
        :disabled="sending"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-amber-50 dark:hover:bg-amber-500/10 active:scale-[0.99] transition text-left disabled:opacity-60 min-w-0"
        @click="emit('pick', 'saved')"
      >
        <span class="relative shrink-0">
          <span class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center text-lg">⭐</span>
        </span>
        <span class="flex-1 min-w-0">
          <span class="flex items-center gap-1.5 text-sm font-semibold text-stone-900 dark:text-white truncate">Избранное</span>
          <span class="block text-[11px] text-stone-400">Себе · сохранится как заметка</span>
        </span>
        <ProgressSpinner v-if="sending && targetId === 'saved'" style="width: 20px; height: 20px" :stroke-width="6" aria-label="Сохраняем в избранное" class="shrink-0" />
        <i v-else class="pi pi-chevron-right text-xs text-stone-300 dark:text-zinc-600 shrink-0"></i>
      </button>
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
          <span class="flex items-center gap-1.5 text-sm font-semibold text-stone-900 dark:text-white truncate">
            {{ rowLabel(c) }}
            <i v-if="c?.is_pinned" class="pi pi-thumbtack text-[10px] text-violet-500 shrink-0"></i>
          </span>
          <span v-if="Number(c?.id) === Number(currentId)" class="block text-[11px] text-stone-400">Этот чат</span>
        </span>
        <ProgressSpinner v-if="sending && targetId != null && targetId !== 'saved' && Number(c?.id) === Number(targetId)" style="width: 20px; height: 20px" :stroke-width="6" aria-label="Пересылаем в этот чат" class="shrink-0" />
        <i v-else class="pi pi-chevron-right text-xs text-stone-300 dark:text-zinc-600 shrink-0"></i>
      </button>
    </div>
  </Dialog>
</template>
