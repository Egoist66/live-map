<script setup lang="ts">
/**
 * Страница автора (/pipe/author/{id}) — шапка, подписка,
 * его pipes тем же фильтром ленты (authorId из props).
 *
 * Свой layout задан явно (defineOptions), иначе персистентная обёртка
 * рендерит AuthenticatedLayout поверх мини-сайта.
 */
import { computed, h, onMounted } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import Button from 'primevue/button'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import PipeThreadCard from '@/Components/Features/Pipe/PipeThreadCard.vue'
import PipeLayout from '@/Layouts/PipeLayout.vue'
import { usePipeFeed } from '@/composables/usePipeFeed'
import { usePipeProfile } from '@/composables/usePipeProfile'
import { usePipeShare } from '@/composables/usePipeShare'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { pipeRoute } from '@/services/pipe.routes'
import type { PipeProfile } from '@/types/pipe'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(PipeLayout, () => child),
})

const props = defineProps<{ profile: PipeProfile }>()

const page = usePipeProfile(props.profile)
const feed = usePipeFeed({ authorId: props.profile.id })
const { shareThread } = usePipeShare()

const feedHasMore = computed(() => feed.store.page < feed.store.lastPage)

const { sentinel: feedSentinel } = useInfiniteScroll({
  hasMore: feedHasMore,
  loading: computed(() => feed.store.loadingMore),
  onLoadMore: () => feed.store.loadMoreThreads(),
})

/** SPA-переход к странице pipe без полного релоада. */
function openThread(threadId: number): void {
  router.visit(pipeRoute('show', { thread: threadId }))
}

onMounted(() => {
  void feed.init()
  void page.refreshStatus()
})
</script>

<template>
  <Head :title="`${page.profile.value.name} — Pipes`" />
  <article class="pt-3 space-y-3">
      <header class="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-5 text-center">
        <div class="flex flex-col items-center gap-2">
          <span class="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-500 text-lg font-black text-white">
            <img
              v-if="page.profile.value.avatar_url"
              :src="page.profile.value.avatar_url"
              :alt="page.profile.value.name"
              width="64"
              height="64"
              class="h-full w-full object-cover"
            />
            <template v-else>{{ page.profile.value.name.slice(0, 1) }}</template>
          </span>

          <h1 class="text-lg font-black">{{ page.profile.value.name }}</h1>
          <p class="text-xs text-stone-500 dark:text-zinc-400">
            {{ page.profile.value.threads_count }} pipes · {{ page.profile.value.followers_count }} читателей
          </p>

          <Button
            v-if="!page.profile.value.is_self"
            :label="page.followButtonLabel.value"
            rounded
            class="mt-1"
            :outlined="page.profile.value.is_following"
            :loading="page.followBusy.value"
            @click="page.toggleFollow()"
          />
        </div>
      </header>

      <div v-if="feed.store.loading" class="space-y-4" aria-busy="true">
        <div v-for="i in 2" :key="i" class="animate-pulse rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-5">
          <div class="h-3 w-1/3 rounded bg-stone-200 dark:bg-white/10" />
          <div class="mt-3 h-3 w-full rounded bg-stone-100 dark:bg-white/[0.06]" />
        </div>
      </div>

      <section v-else-if="!feed.store.threads.length" class="rounded-3xl border border-dashed border-stone-300 dark:border-white/10 bg-white dark:bg-[#0F121F] p-8 text-center">
        <p class="text-sm text-stone-500 dark:text-zinc-400">У автора пока нет pipes.</p>
      </section>

      <section v-else class="space-y-3" aria-label="Pipes автора">
        <PipeThreadCard
          v-for="thread in feed.store.threads"
          :key="thread.id"
          :thread="thread"
          :is-guest="page.isGuest.value"
          :like-busy="Boolean(feed.likeBusy.value[thread.id])"
          :save-busy="Boolean(feed.saveBusy.value[thread.id])"
          @like="feed.toggleLike($event)"
          @save="feed.toggleSave($event)"
          @share="shareThread($event)"
          @delete="feed.removeThread($event)"
          @reply="openThread(thread.id)"
          @report="feed.reportThread(thread, $event)"
        />
        <InfiniteSentinel
          :sentinel="feedSentinel"
          :has-more="feedHasMore"
          :loading="feed.store.loadingMore"
          end-text="Это все pipes автора"
        />
      </section>
    </article>
</template>
