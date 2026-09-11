<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import FlowComposer from '@/Components/Features/Flow/FlowComposer.vue'
import FlowDeleteDialog from '@/Components/Features/Flow/FlowDeleteDialog.vue'
import FlowEditDialog from '@/Components/Features/Flow/FlowEditDialog.vue'
import FlowPostCard from '@/Components/Features/Flow/FlowPostCard.vue'
import { useFlowComposer } from '@/composables/useFlowComposer'
import { useFlowFeed } from '@/composables/useFlowFeed'
import type { FlowPost } from '@/types/flow'

const props = defineProps<{ userId: number; isOwn: boolean; showHeader?: boolean }>()

const showHeader = props.showHeader ?? true

const feed = useFlowFeed({ authorId: props.userId })
const editor = useFlowComposer()
const editOpen = ref(false)

function goFlow(): void {
  router.visit(route('flow'))
}

function goAuthorPosts(): void {
  router.visit(`${route('flow')}?author=${props.userId}`)
}

/**
 * Редактировать пост прямо на странице профиля.
 * @param post пост
 */
function openEdit(post: FlowPost): void {
  editor.startEdit(post.id, post.title, post.body, post.is_anonymous)
  editOpen.value = true
}

onMounted(() => feed.init())
</script>

<template>
  <section class="space-y-4">
    <Toast />
    <div v-if="showHeader" class="flex items-center justify-between">
      <h3 class="text-base font-black tracking-tight text-ink-900 dark:text-white">Flow</h3>
      <Button label="Вся лента UFlow" text severity="secondary" size="small" icon="pi pi-arrow-right" icon-pos="right" @click="goFlow()" />
    </div>
    <FlowComposer v-if="isOwn" :compact="true" />
    <div v-if="feed.store.loading" class="animate-pulse rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-sm text-stone-400">Загружаем посты…</div>
    <div v-else-if="!feed.store.posts.length" class="rounded-3xl border border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-stone-500">
      {{ isOwn ? 'Расскажите о себе первым постом — его увидят все.' : 'У пользователя пока нет постов.' }}
    </div>
    <div v-else class="space-y-4">
      <FlowPostCard
        v-for="post in feed.store.posts.slice(0, 5)"
        :key="post.id"
        :post="post"
        :like-busy="!!feed.likeBusy.value[post.id]"
        @like="feed.toggleLike($event)"
        @edit="openEdit($event)"
        @delete="feed.askDelete($event)"
      />
      <div v-if="feed.store.posts.length > 5" class="flex justify-center">
        <Button label="Все посты пользователя" outlined rounded size="small" @click="goAuthorPosts()" />
      </div>
    </div>
    <FlowEditDialog v-model:visible="editOpen" :composer="editor" />
    <FlowDeleteDialog :visible="feed.pendingDeleteId.value !== null" @cancel="feed.pendingDeleteId.value = null" @confirm="feed.confirmDelete()" />
  </section>
</template>
