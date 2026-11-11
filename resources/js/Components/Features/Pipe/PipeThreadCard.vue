<script setup lang="ts">
/**
 * Карточка pipe в Pipes: аватар (или «Аноним»), текст со спойлером
 * модерации, ряд действий — лайк, ответ, правка, жалоба, удаление.
 *
 * Модерационный блюр честно объясняет причину: читатель может
 * раскрыть карточку, а может сообщить модераторам одним кликом.
 */
import { computed, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import Dialog from 'primevue/dialog'
import { usePipeApp } from '@/composables/usePipeApp'
import type { PipeThread } from '@/types/pipe'

const props = withDefaults(defineProps<{
  thread: PipeThread
  isGuest?: boolean
  likeBusy?: boolean
  saveBusy?: boolean
  compact?: boolean
  /** Правка уместна только в ленте, где тред создан; внутри треда кнопка не нужна. */
  showEdit?: boolean
}>(), {
  isGuest: false,
  likeBusy: false,
  saveBusy: false,
  compact: false,
  showEdit: true,
})

const emit = defineEmits<{
  (e: 'like', threadId: number): void
  (e: 'save', threadId: number): void
  (e: 'share', thread: PipeThread): void
  (e: 'delete', threadId: number): void
  (e: 'reply', thread: PipeThread): void
  (e: 'report', reason: string): void
  (e: 'edit', thread: PipeThread): void
  (e: 'author', author: PipeThread['author']): void
}>()

const confirm = useConfirm()
const { mainHref, visitMain } = usePipeApp()

const revealed = ref(false)
const reportOpen = ref(false)
const reportReason = ref('spam')

const author = computed(() => props.thread.author)
/** Клик по аватару/имени — публичный профиль ULove (не страница mini-app). */
const authorHref = computed(() =>
  author.value?.id && !props.thread.is_anonymous
    ? mainHref(`/users/${author.value.id}`)
    : null,
)

/**
 * Клик по аватару/имени автора: SPA-переход на публичный профиль ULove
 * без перезагрузки (кросс-домен — полный переход внутри visitMain).
 *
 * @param event событие клика по ссылке автора
 */
function onAuthorNavigate(event: MouseEvent): void {
  const authorId = author.value?.id
  if (!authorHref.value || !authorId) return
  event.preventDefault()
  visitMain(`/users/${authorId}`)
}

const moderation = computed(() => props.thread.moderation)
const needsBlur = computed(() => Boolean(moderation.value?.blur) && !revealed.value)

/** Класс сетки картинок: 1 — широкая, 2 — парой, 3 — тройкой. */
const imageGridClass = computed(() => {
  const count = props.thread.images?.length ?? 0
  if (count === 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-2'
  return 'grid-cols-3'
})

const previewUrl = ref<string | null>(null)

const reportReasons = [
  { label: 'Спам', value: 'spam' },
  { label: 'Оскорбления', value: 'abuse' },
  { label: 'Неприемлемый контент', value: 'inappropriate' },
  { label: 'Нарушение закона', value: 'illegal' },
  { label: 'Фейк / недостоверно', value: 'fake' },
]

const timeLabel = computed(() => {
  const iso = props.thread.created_at
  if (!iso) return ''
  try {
    const formatter = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })
    const diff = new Date(iso).getTime() - Date.now()
    const minute = 60_000
    const hour = 60 * minute
    const day = 24 * hour
    if (Math.abs(diff) < hour) return formatter.format(Math.round(diff / minute), 'minute')
    if (Math.abs(diff) < day) return formatter.format(Math.round(diff / hour), 'hour')
    return formatter.format(Math.round(diff / day), 'day')
  } catch {
    return ''
  }
})

function sendReport(): void {
  reportOpen.value = false
  emit('report', reportReason.value)
  reportReason.value = 'spam'
}

function askDelete(): void {
  confirm.require({
    header: 'Удалить pipe?',
    message: 'Ветка ответов удалится вместе с pipe. Действие необратимо.',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: () => emit('delete', props.thread.id),
  })
}
</script>

<template>
  <article
    class="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-4 sm:p-5"
    :aria-label="`Pipe от ${author?.name ?? 'Аноним'} от ${timeLabel}`"
  >
    <header class="flex items-start gap-3">
      <component
        :is="authorHref ? 'a' : 'div'"
        :href="authorHref ?? undefined"
        class="shrink-0"
        :aria-label="authorHref ? `Профиль ${author?.name}` : 'Анонимный автор'"
        @click="onAuthorNavigate($event)"
      >
        <span
          class="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-500 text-sm font-black text-white"
        >
          <template v-if="author?.avatar_url">
            <img :src="author.avatar_url" alt="" class="h-full w-full object-cover" loading="lazy" width="40" height="40" />
          </template>
          <template v-else-if="thread.is_anonymous">🕵️</template>
          <template v-else>{{ (author?.name ?? '?').slice(0, 1) }}</template>
        </span>
      </component>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 text-sm">
          <component
            :is="authorHref ? 'a' : 'span'"
            :href="authorHref ?? undefined"
            class="truncate font-bold hover:underline"
            @click="onAuthorNavigate($event)"
          >
            {{ author?.name ?? 'Аноним' }}
          </component>
          <span v-if="thread.is_anonymous" class="rounded-full bg-stone-100 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-stone-500 dark:text-zinc-400">
            анонимно
          </span>
          <span class="ml-auto shrink-0 text-xs text-stone-400 dark:text-zinc-500" :title="thread.created_at ?? undefined">{{ timeLabel }}</span>
        </div>

        <div
          :class="[needsBlur ? 'select-none blur-[6px] pointer-events-none' : '', compact ? 'mt-1.5 text-[15px]' : 'mt-1.5 whitespace-pre-line break-words text-[15px] leading-relaxed']"
        >
          <template v-if="!needsBlur">{{ thread.body }}</template>
          <template v-else>{{ thread.body.slice(0, 60) }}…</template>
        </div>

        <div
          v-if="!needsBlur && thread.images?.length"
          class="mt-2.5 grid gap-1"
          :class="imageGridClass"
          aria-label="Картинки к pipe"
        >
          <button
            v-for="image in thread.images"
            :key="image.id"
            type="button"
            class="overflow-hidden rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-100 dark:bg-white/5"
            aria-label="Открыть картинку"
            @click="previewUrl = image.url ?? image.thumb_url ?? null"
          >
            <img
              :src="image.thumb_url ?? image.url"
              alt=""
              loading="lazy"
              decoding="async"
              class="w-full object-cover"
              :class="thread.images.length === 1 ? 'aspect-[4/3]' : 'aspect-square'"
            />
          </button>
        </div>

        <button
          v-if="moderation?.blur"
          type="button"
          class="mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
          @click="revealed = !revealed"
        >
          {{ revealed ? 'Скрыть' : (moderation.label ?? 'Показать помеченный текст') }}
        </button>
      </div>
    </header>

    <Dialog
      :visible="Boolean(previewUrl)"
      modal
      :dismissable-mask="true"
      :show-header="false"
      :style="{ width: 'min(92vw, 780px)' }"
      aria-label="Просмотр картинки pipe"
      :pt="{ root: { class: '!rounded-3xl !border-0 !bg-black/90 p-0' }, content: { class: '!p-0' } }"
      @update:visible="previewUrl = null"
    >
      <img :src="previewUrl ?? undefined" alt="" decoding="async" class="mx-auto max-h-[80vh] w-auto max-w-full rounded-3xl object-contain" />
    </Dialog>

    <footer class="mt-3 flex items-center gap-4 text-stone-500 dark:text-zinc-400">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition hover:text-rose-500 active:scale-95 disabled:opacity-50"
        :class="[thread.liked ? 'text-rose-500' : '']"
        :disabled="likeBusy"
        :aria-pressed="thread.liked"
        :aria-label="thread.liked ? 'Снять лайк' : 'Лайк'"
        @click="emit('like', thread.id)"
      >
        <i :class="thread.liked ? 'pi pi-heart-fill' : 'pi pi-heart'" aria-hidden="true" />
        <span class="tabular-nums">{{ thread.likes_count > 0 ? thread.likes_count : '' }}</span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition hover:text-sky-600 dark:hover:text-sky-400 active:scale-95"
        :aria-label="`Ответить, всего ответов ${thread.replies_count}`"
        @click="emit('reply', thread)"
      >
        <i class="pi pi-comment" aria-hidden="true" />
        <span class="tabular-nums">{{ thread.replies_count > 0 ? thread.replies_count : '' }}</span>
      </button>

      <button
        v-if="!isGuest"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition active:scale-95 disabled:opacity-50"
        :class="[thread.saved ? 'text-amber-500 dark:text-amber-400' : 'hover:text-amber-600 dark:hover:text-amber-400']"
        :disabled="saveBusy"
        :aria-pressed="thread.saved"
        :aria-label="thread.saved ? 'Убрать из избранного' : 'Сохранить в избранное'"
        @click="emit('save', thread.id)"
      >
        <i :class="thread.saved ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'" aria-hidden="true" />
      </button>

      <span class="ml-auto" />

      <button
        type="button"
        class="rounded-full p-1.5 text-sm transition hover:text-sky-600 dark:hover:text-sky-400"
        aria-label="Поделиться pipe"
        @click="emit('share', props.thread)"
      >
        <i class="pi pi-share-alt" aria-hidden="true" />
      </button>

      <button
        v-if="thread.can_edit && showEdit"
        type="button"
        class="rounded-full p-1.5 text-sm transition hover:text-violet-600 dark:hover:text-violet-400"
        aria-label="Редактировать pipe"
        @click="emit('edit', props.thread)"
      >
        <i class="pi pi-pencil" aria-hidden="true" />
      </button>

      <button
        v-if="!isGuest"
        type="button"
        class="rounded-full p-1.5 text-sm transition hover:text-amber-600 dark:hover:text-amber-400"
        aria-label="Сообщить о нарушении"
        @click="reportOpen = true"
      >
        <i class="pi pi-flag" aria-hidden="true" />
      </button>

      <button
        v-if="thread.can_delete"
        type="button"
        class="rounded-full p-1.5 text-sm transition hover:text-red-600 dark:hover:text-red-400"
        aria-label="Удалить pipe"
        @click="askDelete"
      >
        <i class="pi pi-trash" aria-hidden="true" />
      </button>
    </footer>

    <div v-if="reportOpen" class="mt-3 rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
      <p class="text-xs font-bold text-amber-700 dark:text-amber-300">Что не так с этим pipe?</p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="reason in reportReasons"
          :key="reason.value"
          type="button"
          class="rounded-full border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:text-zinc-300 transition hover:border-amber-400 hover:text-amber-700"
          @click="reportReason = reason.value; sendReport()"
        >
          {{ reason.label }}
        </button>
      </div>
      <button
        type="button"
        class="mt-2 text-[11px] font-semibold text-stone-400 hover:underline"
        @click="reportOpen = false"
      >
        Отмена
      </button>
    </div>
  </article>
</template>
