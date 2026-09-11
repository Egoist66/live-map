<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Head } from '@inertiajs/vue3'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Toast from 'primevue/toast'
import FlowComposer from '@/Components/Features/Flow/FlowComposer.vue'
import FlowDeleteDialog from '@/Components/Features/Flow/FlowDeleteDialog.vue'
import FlowEditDialog from '@/Components/Features/Flow/FlowEditDialog.vue'
import FlowPostCard from '@/Components/Features/Flow/FlowPostCard.vue'
import { useFlowFeed } from '@/composables/useFlowFeed'
import { useFlowComposer } from '@/composables/useFlowComposer'
import type { FlowPost } from '@/types/flow'

const props = defineProps<{ postId?: number | null }>()

const feed = useFlowFeed({ postId: props.postId ?? null })
const editor = useFlowComposer()
const editOpen = ref(false)
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => feed.setSearch(searchInput.value.trim()), 400)
}

function openEdit(post: FlowPost) {
  editor.startEdit(post.id, post.title, post.body, post.is_anonymous)
  editOpen.value = true
}

onMounted(() => feed.init())
</script>

<template>
  <Head title="UFlow — лента" />
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
      <div class="mx-auto max-w-[680px] px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-xl font-black tracking-tight bg-gradient-to-r from-sky-500 via-blue-600 to-fuchsia-500 bg-clip-text text-transparent">UFlow</span>
          <span class="text-xs text-stone-400">новости друзей и людей рядом</span>
        </div>

        <FlowComposer />

        <div v-if="feed.store.authorId" class="flex items-center justify-between gap-2 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-600/20 px-4 py-2.5 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <span>Посты пользователя</span>
          <button class="underline hover:no-underline" @click="feed.clearAuthor()">Вся лента</button>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
          <SelectButton :model-value="feed.store.filter" :options="feed.tabs.value" option-label="label" option-value="value" class="max-w-full overflow-x-auto self-start sm:self-auto" @update:model-value="feed.setFilter($event)" />
          <span class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm" />
            <InputText v-model="searchInput" placeholder="Поиск по новостям…" class="w-full !rounded-full !pl-9" @input="onSearch()" />
          </span>
        </div>

        <div v-if="feed.store.loading" class="space-y-4">
          <div v-for="i in 3" :key="i" class="animate-pulse rounded-3xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 p-5">
            <div class="h-4 w-1/3 rounded bg-stone-200 dark:bg-zinc-700" />
            <div class="mt-3 h-3 rounded bg-stone-100 dark:bg-zinc-800" />
            <div class="mt-2 h-3 w-2/3 rounded bg-stone-100 dark:bg-zinc-800" />
          </div>
        </div>

        <div v-else-if="!feed.store.posts.length" class="rounded-3xl border border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 text-center">
          <div class="text-3xl">📰</div>
          <div class="mt-2 font-bold text-ink-900 dark:text-white">Пока пусто</div>
          <div class="mt-1 text-sm text-stone-500">Опубликуйте первую новость или загляните во вкладку «Подписки».</div>
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
          />
          <div class="flex justify-center pt-1">
            <Button
              v-if="feed.store.hasMore()"
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
  </AuthenticatedLayout>
</template>
