<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { useFlowRepost } from '@/composables/useFlowRepost'
import type { FlowPost } from '@/types/flow'

const props = defineProps<{ post: FlowPost | null }>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const reposter = useFlowRepost()
const comment = ref('')
const MAX_COMMENT = 500

watch(() => props.post, () => {
  comment.value = ''
})

/**
 * Опубликовать репост (с цитатой или тихий).
 */
async function publish(): Promise<void> {
  if (!props.post) return
  const ok = await reposter.repost(props.post.id, comment.value.trim() || null)
  if (ok) emit('close')
}

/**
 * Убрать свой репост.
 */
async function remove(): Promise<void> {
  if (!props.post) return
  const ok = await reposter.unrepost(props.post)
  if (ok) emit('close')
}
</script>

<template>
  <Dialog :visible="!!post" @update:visible="(v: boolean) => { if (!v) emit('close') }" modal dismissableMask :draggable="false" header="Репост" :breakpoints="{ '640px': '100vw' }" :style="{ width: '440px' }">
    <div v-if="post" class="space-y-3">
      <div class="rounded-2xl bg-stone-100 dark:bg-zinc-800 px-3 py-2.5 text-[13px] text-stone-600 dark:text-zinc-300">
        <span class="font-bold text-ink-900 dark:text-white">{{ post.author.name }}</span>
        <span class="mt-0.5 block line-clamp-3">{{ post.repost ? reposter.originExcerpt(post.repost, 140) : (post.body || '').slice(0, 140) }}</span>
      </div>
      <Textarea v-model="comment" rows="3" :maxlength="MAX_COMMENT" placeholder="Добавить цитату (необязательно)…" class="w-full !rounded-2xl" />
      <div class="flex items-center gap-2">
        <Button label="Репост" icon="pi pi-forward" rounded class="flex-1" :loading="post ? reposter.isBusy(post.id) : false" :disabled="!post" @click="publish()" />
        <Button v-if="post.my_repost_id" label="Убрать" icon="pi pi-trash" rounded outlined severity="danger" :loading="reposter.isBusy(post.my_repost_id)" @click="remove()" />
      </div>
      <p class="text-center text-[11px] text-stone-400">Пост появится на вашей странице</p>
    </div>
  </Dialog>
</template>
