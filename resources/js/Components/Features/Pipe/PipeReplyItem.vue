<script setup lang="ts">
/**
 * Ответ треда Pipe (рекурсивный уровень ветки).
 *
 * Компонент рисует один ответ и его вложенных детей тем же
 * компонентом: вложенность 3+ уровней остаётся читаемой и с
 * a11y-разметкой (li/ul). Модерационный блюр объясняется флагом сервера
 * и кнопкой раскрытия.
 */
import { computed, ref } from 'vue'
import type { PipeReply } from '@/types/pipe'

const props = defineProps<{
  reply: PipeReply
  isGuest?: boolean
  likeBusy?: boolean
}>()

const emit = defineEmits<{
  /** Ответить на этот ответ (композер берёт parent_id). */
  (e: 'reply', reply: PipeReply): void
  /** Перейти на страницу автора. */
  (e: 'author', anchor: { id: number | null }): void
  /** Удалить ответ (владелец/админ). */
  (e: 'delete', replyId: number): void
  /** Лайк / анлайк ответа. */
  (e: 'like', replyId: number): void
  /** Жалоба на ответ. */
  (e: 'report', payload: { replyId: number; reason: string }): void
}>()

const revealed = ref(false)
const reportOpen = ref(false)
const reportReason = ref('spam')
/** Ветка детей сворачивается: длинные ветки читаются по частям. */
const branchOpen = ref(true)

const needsBlur = computed(() => Boolean(props.reply.moderation?.blur) && !revealed.value)

/** Короткая цитата родительского ответа: контекст глубокой ветки. */
const parentQuote = computed(() => {
  const parent = props.reply.parent
  if (!parent) return null
  const excerpt = parent.body.length > 90 ? `${parent.body.slice(0, 90)}…` : parent.body
  return { authorName: parent.author?.name ?? 'Аноним', excerpt }
})

const timeLabel = computed(() => {
  const iso = props.reply.created_at
  if (!iso) return ''
  try {
    const formatter = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' })
    const diff = new Date(iso).getTime() - Date.now()
    const minute = 60_000
    if (Math.abs(diff) < 60 * minute) return formatter.format(Math.round(diff / minute), 'minute')
    return formatter.format(Math.round(diff / (24 * minute)), 'day')
  } catch {
    return ''
  }
})

const reportReasons = [
  { label: 'Спам', value: 'spam' },
  { label: 'Оскорбления', value: 'abuse' },
  { label: 'Неприемлемый контент', value: 'inappropriate' },
  { label: 'Нарушение закона', value: 'illegal' },
  { label: 'Фейк / недостоверно', value: 'fake' },
]

const isAuthorClickable = computed(() => Boolean(props.reply.author?.id) && !props.reply.is_anonymous)

function sendReport(): void {
  reportOpen.value = false
  emit('report', { replyId: props.reply.id, reason: reportReason.value })
  reportReason.value = 'spam'
}
</script>

<template>
  <li class="min-w-0 list-none">
    <div class="flex items-start gap-2.5">
      <span class="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-black text-white">
        <img
          v-if="reply.author?.avatar_url"
          :src="reply.author.avatar_url"
          alt=""
          width="32"
          height="32"
          loading="lazy"
          class="h-full w-full object-cover"
        />
        <template v-else-if="reply.is_anonymous">🕵️</template>
        <template v-else>{{ (reply.author?.name ?? '?').slice(0, 1) }}</template>
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            v-if="isAuthorClickable"
            type="button"
            class="truncate font-bold text-stone-700 hover:underline dark:text-zinc-200"
            @click="emit('author', { id: reply.author!.id! })"
          >
            {{ reply.author?.name }}
          </button>
          <span v-else class="truncate font-bold text-stone-700 dark:text-zinc-200">{{ reply.author?.name ?? 'Аноним' }}</span>
          <span class="shrink-0 text-stone-400 dark:text-zinc-500">{{ timeLabel }}</span>
        </div>

        <div
          v-if="parentQuote"
          class="mt-1 flex items-start gap-1.5 rounded-xl border-l-2 border-stone-200 bg-stone-50 px-2 py-1 text-[12px] leading-snug text-stone-500 dark:border-white/15 dark:bg-white/[0.06] dark:text-zinc-400"
          aria-label="Ответ на указанное сообщение"
        >
          <i class="pi pi-reply mt-[2px] shrink-0 text-[10px]" aria-hidden="true" />
          <span class="min-w-0">
            <span class="font-semibold text-stone-600 dark:text-zinc-300">{{ parentQuote.authorName }}</span>
            <span class="text-stone-400 dark:text-zinc-500"> · </span>
            <span class="break-words">«{{ parentQuote.excerpt }}»</span>
          </span>
        </div>

        <p :class="['mt-0.5 break-words text-[14px] leading-snug', needsBlur ? 'pointer-events-none select-none blur-[5px]' : '']">
          {{ reply.body }}
        </p>

        <button
          v-if="reply.moderation?.blur"
          type="button"
          class="mt-0.5 text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
          @click="revealed = !revealed"
        >
          {{ revealed ? 'Скрыть' : (reply.moderation.label ?? 'Показать помеченный ответ') }}
        </button>

        <div class="mt-1 flex items-center gap-3 text-stone-500 dark:text-zinc-400">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[13px] transition hover:text-rose-500 active:scale-95 disabled:opacity-50"
            :class="[reply.liked ? 'text-rose-500' : '']"
            :disabled="likeBusy"
            :aria-pressed="reply.liked"
            :aria-label="reply.liked ? 'Снять лайк' : 'Лайк'"
            @click="emit('like', reply.id)"
          >
            <i :class="reply.liked ? 'pi pi-heart-fill' : 'pi pi-heart'" aria-hidden="true" />
            <span v-if="reply.likes_count > 0" class="tabular-nums">{{ reply.likes_count }}</span>
          </button>

          <button
            v-if="!isGuest"
            type="button"
            class="inline-flex items-center gap-1 text-[13px] transition hover:text-sky-600 dark:hover:text-sky-400"
            aria-label="Ответить на ответ"
            @click="emit('reply', reply)"
          >
            <i class="pi pi-reply" aria-hidden="true" />
            <span>Ответить</span>
          </button>

          <button
            v-if="!isGuest"
            type="button"
            class="inline-flex items-center gap-1 text-[13px] transition hover:text-amber-600 dark:hover:text-amber-400"
            aria-label="Сообщить о нарушении"
            @click="reportOpen = !reportOpen"
          >
            <i class="pi pi-flag" aria-hidden="true" />
          </button>

          <button
            v-if="reply.can_delete"
            type="button"
            class="inline-flex items-center gap-1 text-[13px] transition hover:text-red-600 dark:hover:text-red-400"
            aria-label="Удалить ответ"
            @click="emit('delete', reply.id)"
          >
            <i class="pi pi-trash" aria-hidden="true" />
          </button>
        </div>

        <div v-if="reportOpen" class="mt-2 rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-2.5">
          <p class="text-[11px] font-bold text-amber-700 dark:text-amber-300">Пожаловаться на ответ?</p>
          <div class="mt-1.5 flex flex-wrap gap-1">
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
        </div>
      </div>
    </div>

        <button
          v-if="reply.replies?.length"
          type="button"
          class="mt-1.5 inline-flex items-center gap-1 rounded-full text-[13px] font-semibold text-stone-500 transition hover:text-stone-700 active:scale-95 dark:text-zinc-400 dark:hover:text-zinc-200"
          :aria-expanded="branchOpen"
          :aria-label="branchOpen ? 'Свернуть ветку ответов' : 'Развернуть ветку ответов'"
          @click="branchOpen = !branchOpen"
        >
          <i :class="branchOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true" />
          <span>{{ branchOpen ? 'Свернуть ветку' : `Показать ветку · ${reply.replies_count || reply.replies.length}` }}</span>
        </button>

        <ul
          v-if="reply.replies?.length && branchOpen"
          class="mt-3 space-y-3 border-l border-stone-200 pl-3 dark:border-white/10"
          role="list"
        >
      <PipeReplyItem
        v-for="child in reply.replies"
        :key="child.id"
        :reply="child"
        :is-guest="isGuest"
        :like-busy="likeBusy"
        @reply="emit('reply', $event)"
        @author="emit('author', $event)"
        @delete="emit('delete', $event)"
        @like="emit('like', $event)"
        @report="emit('report', $event)"
      />
    </ul>
  </li>
</template>
