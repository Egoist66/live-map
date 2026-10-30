<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Toast from 'primevue/toast'
import FlowDeleteDialog from '@/Components/Features/Flow/FlowDeleteDialog.vue'
import FlowEditDialog from '@/Components/Features/Flow/FlowEditDialog.vue'
import FlowPostCard from '@/Components/Features/Flow/FlowPostCard.vue'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import { useFlowFeed } from '@/composables/useFlowFeed'
import { useFlowComposer } from '@/composables/useFlowComposer'
import { useFlowTags } from '@/composables/useFlowTags'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import type { FlowPost } from '@/types/flow'

const props = defineProps<{ postId?: number | null }>()

const feed = useFlowFeed({ postId: props.postId ?? null })
const tags = useFlowTags()
const editor = useFlowComposer()
const editOpen = ref(false)
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const feedHasMore = computed(() => feed.store.page < feed.store.lastPage)
const feedLoadingMore = computed(() => feed.store.loadingMore)
const { sentinel: feedSentinel } = useInfiniteScroll({
  hasMore: feedHasMore,
  loading: feedLoadingMore,
  onLoadMore: () => feed.store.loadMore(),
})

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => feed.setSearch(searchInput.value.trim()), 400)
}

function openEdit(post: FlowPost) {
  editor.startEdit(post)
  editOpen.value = true
}

onMounted(() => {
  void feed.init()
  void tags.load()
})
</script>

<template>
  <Head title="UFlow — лента" />
  <Toast />
    <div class="page-scroll bg-surface dark:bg-[#0F121F]">
      <div class="mx-auto max-w-[680px] px-2 sm:px-6 py-3 sm:py-6 space-y-3 sm:space-y-4 lg:max-w-[760px] xl:max-w-[820px]">
        <div class="flex items-center gap-3">
          <span class="text-xl font-black tracking-tight bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent">UFlow</span>
          <span class="text-xs text-stone-400">новости друзей и людей рядом</span>
        </div>

        <div v-if="feed.store.authorId" class="flex items-center justify-between gap-2 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-600/20 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <span>Посты пользователя</span>
          <button class="underline hover:no-underline" @click="feed.clearAuthor()">Вся лента</button>
        </div>

        <div v-if="feed.store.tag" class="flex items-center justify-between gap-2 rounded-2xl bg-violet-600/10 dark:bg-violet-500/10 border border-violet-600/20 px-4 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
          <span class="truncate">#{{ feed.store.tag }}</span>
          <button class="underline hover:no-underline shrink-0" @click="feed.setTag(null)">Вся лента</button>
        </div>

        <div v-if="tags.trending.value.length" class="trend-chips flex gap-1.5 overflow-x-auto pb-1">
          <button
            v-for="t in tags.trending.value"
            :key="t.id"
            type="button"
            :class="['shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition active:scale-95', feed.store.tag === t.name ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white dark:bg-[#0F121F] border-stone-200 dark:border-white/10 text-stone-600 dark:text-zinc-300']"
            @click="feed.setTag(feed.store.tag === t.name ? null : t.name)"
          >
            #{{ t.name }}
          </button>
        </div>

        <div class="flex flex-col min-[411px]:flex-col sm:flex-row sm:items-center gap-2 min-w-0 max-w-full">
          <SelectButton :model-value="feed.store.filter" :options="feed.tabs.value" option-label="label" option-value="value" class="max-w-[calc(100vw-1rem)] sm:max-w-full overflow-x-auto self-start sm:self-auto flex-nowrap" @update:model-value="feed.setFilter($event)" />
          <span class="relative flex-1 min-w-0 w-full">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
            <InputText v-model="searchInput" placeholder="Поиск по новостям…" class="w-full !rounded-full !pl-9" @input="onSearch()" />
          </span>
        </div>

        <div v-if="feed.store.loading" class="space-y-4">
          <div v-for="i in 3" :key="i" class="animate-pulse rounded-3xl bg-white dark:bg-[#0F121F] border border-stone-200 dark:border-white/10 p-5">
            <div class="h-4 w-1/3 rounded bg-stone-200 dark:bg-white/10" />
            <div class="mt-3 h-3 rounded bg-stone-100 dark:bg-white/[0.06]" />
            <div class="mt-2 h-3 w-2/3 rounded bg-stone-100 dark:bg-white/[0.06]" />
          </div>
        </div>

        <div v-else-if="!feed.store.posts.length" class="rounded-3xl border border-dashed border-stone-300 dark:border-white/10 bg-white dark:bg-[#0F121F] p-8 text-center">
          <div class="text-3xl">📰</div>
          <div class="mt-2 font-bold text-ink-900 dark:text-white">Пока пусто</div>
          <div class="mt-1 text-sm text-stone-500">Новости публикуются из профиля — загляните во вкладку «Подписки».</div>
        </div>

        <div v-else class="space-y-4">
          <FlowPostCard
            v-for="post in feed.store.posts"
            :key="post.id"
            :post="post"
            :like-busy="!!feed.likeBusy.value[post.id]"
            @like="feed.toggleLike($event)"
            @edit="openEdit($event)"
            @delete="feed.askDelete($event)"
            @tag="feed.setTag($event)"
          />
          <InfiniteSentinel :sentinel="feedSentinel" :has-more="feed.store.page < feed.store.lastPage" :loading="feed.store.loadingMore" end-text="Это все новости" />
          <div v-if="feed.store.page < feed.store.lastPage" class="flex justify-center pt-1">
            <Button
              label="Показать ещё"
              rounded
              outlined
              :loading="feed.store.loadingMore"
              @click="feed.store.loadMore()"
            />
          </div>
        </div>
      </div>
    </div>

    <FlowEditDialog v-model:visible="editOpen" :composer="editor" />

    <FlowDeleteDialog :visible="feed.pendingDeleteId.value !== null" @cancel="feed.pendingDeleteId.value = null" @confirm="feed.confirmDelete()" />
</template>

<style scoped>
.trend-chips {
  scrollbar-width: none;
}
.trend-chips::-webkit-scrollbar {
  display: none;
}
</style>
