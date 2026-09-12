<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Toast from 'primevue/toast'
import FlowComposer from '@/Components/Features/Flow/FlowComposer.vue'
import FlowDeleteDialog from '@/Components/Features/Flow/FlowDeleteDialog.vue'
import FlowEditDialog from '@/Components/Features/Flow/FlowEditDialog.vue'
import FlowPostCard from '@/Components/Features/Flow/FlowPostCard.vue'
import { useFlowComposer } from '@/composables/useFlowComposer'
import { useFlowFeed } from '@/composables/useFlowFeed'
import type { FlowPost } from '@/types/flow'

const props = defineProps<{ userId: number; isOwn: boolean; showHeader?: boolean; limit?: number; previewModal?: boolean }>()

const showHeader = props.showHeader ?? true
const previewLimit = computed(() => props.limit ?? 5)

const feed = useFlowFeed({ authorId: props.userId })
const editor = useFlowComposer()
const editOpen = ref(false)
const allOpen = ref(false)
const previewPosts = computed(() => feed.store.posts.slice(0, previewLimit.value))
const hiddenCount = computed(() => Math.max(0, feed.store.posts.length - previewLimit.value))

/** Открывает большую модалку со всеми постами. */
function openAll(): void {
  allOpen.value = true
}

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
        v-for="post in previewPosts"
        :key="post.id"
        :post="post"
        :like-busy="!!feed.likeBusy.value[post.id]"
        @like="feed.toggleLike($event)"
        @edit="openEdit($event)"
        @delete="feed.askDelete($event)"
      />
      <div v-if="hiddenCount > 0 && previewModal" class="flex justify-center">
        <Button :label="`Показать ещё · ${hiddenCount}`" icon="pi pi-chevron-down" rounded outlined size="small" @click="openAll()" />
      </div>
      <div v-else-if="hiddenCount > 0" class="flex justify-center">
        <Button label="Все посты пользователя" outlined rounded size="small" @click="goAuthorPosts()" />
      </div>
    </div>
    <Dialog v-model:visible="allOpen" modal dismissableMask :closable="true" :draggable="false" header="Все посты" :breakpoints="{ '640px': '100vw' }" :style="{ width: '720px' }" :pt="{ content: { class: '!p-0' }, header: { class: '!py-3 !px-3 sm:!px-5' } }">
      <div class="px-3 sm:px-5 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[78dvh] overflow-y-auto overscroll-contain space-y-4">
        <FlowPostCard
          v-for="post in feed.store.posts"
          :key="post.id"
          :post="post"
          :like-busy="!!feed.likeBusy.value[post.id]"
          @like="feed.toggleLike($event)"
          @edit="openEdit($event)"
          @delete="feed.askDelete($event)"
        />
      </div>
    </Dialog>
    <FlowEditDialog v-model:visible="editOpen" :composer="editor" />
    <FlowDeleteDialog :visible="feed.pendingDeleteId.value !== null" @cancel="feed.pendingDeleteId.value = null" @confirm="feed.confirmDelete()" />
  </section>
</template>
