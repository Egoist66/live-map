<script setup lang="ts">
/**
 * Тред Pipe (/pipe/thread/{id}) — карточка pipe и ветка ответов.
 *
 * Свой layout задан явно (defineOptions), иначе персистентная обёртка
 * рендерит AuthenticatedLayout поверх мини-сайта.
 *
 * Диплинк приходит из PipePageController::show (threadId);
 * realtime-живность ветки — CommentThreadUpdated touch(pipe)
 * через store.subscribeRealtime → reloadReplies.
 */
import { computed, h, onBeforeUnmount, onMounted } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import PipeThreadCard from '@/Components/Features/Pipe/PipeThreadCard.vue'
import PipeReplyItem from '@/Components/Features/Pipe/PipeReplyItem.vue'
import PipeLayout from '@/Layouts/PipeLayout.vue'
import { usePipeThread } from '@/composables/usePipeThread'
import { usePipeShare } from '@/composables/usePipeShare'
import { usePipeApp } from '@/composables/usePipeApp'
import { pipeApi } from '@/services/pipe.api'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { useConfirm } from 'primevue/useconfirm'
import { route } from '@/route'
import type { PipeReply } from '@/types/pipe'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(PipeLayout, () => child),
})

const props = defineProps<{ threadId: number }>()

const thread = usePipeThread(() => props.threadId)
const { mainHref, visitMain } = usePipeApp()
const { shareThread } = usePipeShare()
const confirm = useConfirm()
let stopLive: (() => void) | null = null

const repliesHasMore = computed(() => thread.store.hasMoreReplies())
const repliesLoadingMore = computed(() => thread.store.repliesLoadingMore)
const hasReplies = computed(() => thread.store.replies.length > 0)
const stateLoading = computed(() => thread.store.repliesLoading && !thread.store.currentThread)

const { sentinel: repliesSentinel } = useInfiniteScroll({
  hasMore: repliesHasMore,
  loading: repliesLoadingMore,
  onLoadMore: () => thread.store.loadMoreReplies(),
})

/** Лайк треда сверху страницы (без поллинга ленты). */
async function likeThread(): Promise<void> {
  if (thread.isGuest.value) return
  const target = thread.store.currentThread
  if (!target) return

  try {
    thread.store.applyLike(target.id, !target.liked, target.likes_count + (target.liked ? -1 : 1))
    const res = await pipeApi.toggleLike(target.id)
    thread.store.applyLike(target.id, res.liked, res.likes_count)
  } catch {
    const fresh = await pipeApi.show(target.id).catch(() => null)
    if (fresh) thread.store.applyLike(target.id, fresh.liked, fresh.likes_count)
  }
}

/** Удалить свой тред со страницы треда: возврат в ленту. */
function askDeleteThread(): void {
  const target = thread.store.currentThread
  const canDelete = target?.can_delete
  if (!target || !canDelete) return

  confirm.require({
    header: 'Удалить pipe?',
    message: 'Ветка ответов удалится вместе с тредом. Действие необратимо.',
    acceptLabel: 'Удалить',
    rejectLabel: 'Отмена',
    accept: async () => {
      try {
        await pipeApi.remove(target.id)
        router.visit(String(route('pipe.index')))
      } catch { /* остаёмся, тост покажет реальную ошибку сети */ }
    },
  })
}

/** Композер ответа: null — ответ на сам тред. */
function onReply(reply: PipeReply | null): void {
  thread.startReplyTo(reply)
}

/** Клик по автору ответа: SPA-переход на публичный профиль ULove без перезагрузки. */
function onAuthorAnchor(anchor: { id: number | null } | null): void {
  if (!anchor?.id) return
  visitMain(`/users/${anchor.id}`)
}

/** Жалоба на ответ (в т.ч. вложенный) из ветки. */
function onReplyReport(payload: { replyId: number; reason: string }): void {
  let target: PipeReply | null = null
  const walk = (list: PipeReply[]): void => {
    for (const item of list) {
      if (item.id === payload.replyId) target = item
      if (item.replies?.length) walk(item.replies)
    }
  }

  walk(thread.store.replies)
  if (target) void thread.reportReply(target as PipeReply, payload.reason)
}

/** Возврат в ленту: SPA-переход без полного перезагруза страницы. */
function goToFeed(): void {
  router.visit(String(route('pipe.index')))
}

onMounted(() => {
  void thread.load(props.threadId)
  // Live-ветка: сокет threads.pipe + поллинг-watch (оба транспорта
  // сводятся в одинаковую перезагрузку ветки).
  stopLive = thread.bindLive()
  // Счётчики лайков/ответов и карточки ленты живут на notification-шине.
  thread.store.subscribeRealtime()
})

onBeforeUnmount(() => {
  stopLive?.()
  stopLive = null
  thread.store.currentThread = null
})
</script>

<template>
  <Head :title="`Pipes — pipe #${threadId}`" />
    <div class="pt-3 space-y-3">
      <nav class="flex items-center gap-2" aria-label="Назад к ленте">
        <Button
          icon="pi pi-arrow-left"
          text
          rounded
          severity="secondary"
          aria-label="Назад к ленте"
          @click="goToFeed"
        />
        <span class="text-sm font-bold text-stone-500 dark:text-zinc-400">Pipe</span>
      </nav>

      <div v-if="stateLoading" class="animate-pulse rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-5" aria-busy="true">
        <div class="flex gap-3">
          <div class="h-10 w-10 rounded-full bg-stone-200 dark:bg-white/10" />
          <div class="flex-1 space-y-2">
            <div class="h-3 w-24 rounded bg-stone-200 dark:bg-white/10" />
            <div class="h-3 w-full rounded bg-stone-100 dark:bg-white/[0.06]" />
            <div class="h-3 w-2/3 rounded bg-stone-100 dark:bg-white/[0.06]" />
          </div>
        </div>
      </div>

      <template v-else-if="thread.store.currentThread">
        <PipeThreadCard
          :thread="thread.store.currentThread"
          :is-guest="thread.isGuest.value"
          :save-busy="thread.saveBusy.value"
          :show-edit="false"
          @like="likeThread"
          @save="thread.toggleThreadSave()"
          @share="shareThread($event)"
          @reply="onReply(null)"
          @delete="askDeleteThread"
        />

        <section class="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-4 sm:p-5" aria-label="Ответы на pipe">
          <h2 class="text-sm font-bold text-stone-600 dark:text-zinc-300">
            Ответы · {{ thread.store.currentThread.replies_count }}
          </h2>

          <ul v-if="hasReplies" class="mt-3 space-y-4" role="list">
            <PipeReplyItem
              v-for="reply in thread.store.replies"
              :key="reply.id"
              :reply="reply"
              :is-guest="thread.isGuest.value"
              :like-busy="Boolean(thread.replyBusy.value[reply.id])"
              @reply="onReply($event)"
              @author="onAuthorAnchor($event)"
              @delete="thread.deleteReply($event)"
              @like="thread.toggleReplyLike($event)"
              @report="onReplyReport"
            />
          </ul>

          <p v-else-if="thread.store.repliesLoading" class="mt-3 text-sm text-stone-400 dark:text-zinc-500" aria-live="polite">
            Загружаем ответы…
          </p>

          <p v-else class="mt-3 text-sm text-stone-500 dark:text-zinc-400">
            Ответов пока нет. {{ thread.isGuest.value ? 'Войдите, чтобы ответить.' : 'Скажите первым — форма ниже.' }}
          </p>

          <InfiniteSentinel
            :sentinel="repliesSentinel"
            :has-more="repliesHasMore"
            :loading="repliesLoadingMore"
            end-text="Это все ответы"
          />
        </section>

        <section v-if="!thread.isGuest.value" class="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-4" aria-label="Форма ответа">
          <div v-if="thread.replyParent.value" class="mb-2 rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
            <div class="flex items-start justify-between gap-2">
              <span class="min-w-0 leading-snug">
                <span class="font-bold">Ответ {{ thread.replyQuote.value?.authorName }}</span>
                <span class="font-semibold"> · «{{ thread.replyQuote.value?.excerpt }}»</span>
              </span>
              <button type="button" class="shrink-0 rounded-full p-0.5 transition hover:bg-rose-500/20 active:scale-95" aria-label="Отменить выбор адресата" @click="thread.startReplyTo(null)">
                <i class="pi pi-times" aria-hidden="true" />
              </button>
            </div>
          </div>

          <form class="space-y-2" @submit.prevent="thread.sendReply()">
            <Textarea
              v-model="thread.replyBody.value"
              :maxlength="300"
              auto-resize
              rows="3"
              :placeholder="thread.replyParent.value ? 'Ответить на ответ…' : 'Ответить на pipe…'"
              class="w-full resize-none"
              aria-label="Текст ответа"
            />
            <div class="flex items-center justify-between gap-3">
              <label class="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-zinc-300">
                <ToggleSwitch v-model="thread.replyAnonymous.value" aria-label="Анонимный ответ" />
                Анонимно
              </label>
              <span class="text-xs tabular-nums text-stone-400 dark:text-zinc-500">{{ thread.left.value }}</span>
              <Button type="submit" label="Отправить" rounded size="small" :disabled="!thread.canSend.value" :loading="thread.sending.value" />
            </div>
          </form>
        </section>

        <p v-else class="rounded-2xl border border-stone-200 dark:border-white/10 px-4 py-3 text-center text-sm">
          <a :href="mainHref('/login')" class="font-bold text-sky-600 hover:underline dark:text-sky-400">Войти</a>
          <span class="text-stone-500 dark:text-zinc-400"> — чтобы ответить и лайкать</span>
        </p>
      </template>
    </div>
  
</template>
