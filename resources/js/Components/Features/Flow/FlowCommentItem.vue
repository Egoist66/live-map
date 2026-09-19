<script setup lang="ts">
import { ref } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import { formatFlowDate } from '@/utils/flowDate'
import type { FlowComment } from '@/types/flow'

const props = withDefaults(defineProps<{
  comment: FlowComment
  depth?: number
  more: (c: FlowComment) => boolean
  loading: (c: FlowComment) => boolean
}>(), { depth: 0 })

const emit = defineEmits<{
  (e: 'reply', comment: FlowComment): void
  (e: 'remove', comment: FlowComment): void
  (e: 'children', comment: FlowComment): void
}>()

const collapsed = ref(false)
const shownKids = () => props.comment.replies?.length ?? 0
const totalKids = () => props.comment.replies_count ?? shownKids()
const hasKids = () => shownKids() > 0 || props.more(props.comment)
const hiddenKids = () => Math.max(0, totalKids() - shownKids())
const authorName = () => props.comment.author?.name || 'Аноним'
</script>

<template>
  <div class="flex min-w-0 gap-2.5">
    <Avatar v-if="comment.author.avatar_url" :image="comment.author.avatar_url" shape="circle" class="!w-8 !h-8 shrink-0" />
    <Avatar v-else icon="pi pi-user-secret" shape="circle" class="!w-8 !h-8 shrink-0 !bg-stone-200 dark:!bg-zinc-700" />
    <div class="min-w-0 flex-1">
      <div class="min-w-0 rounded-2xl bg-stone-100 dark:bg-zinc-800 px-3 py-2">
        <div class="truncate text-[13px] font-bold leading-tight text-ink-900 dark:text-white">{{ authorName() }}</div>
        <div class="mt-0.5 whitespace-pre-line break-words text-[14px] leading-[1.5] text-stone-700 dark:text-zinc-200 [overflow-wrap:anywhere]">{{ comment.content }}</div>
      </div>
      <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-1 pt-1 text-xs text-stone-400">
        <span class="shrink-0">{{ formatFlowDate(comment.created_at) }}</span>
        <button class="shrink-0 px-1 py-1.5 font-semibold text-stone-500 dark:text-zinc-400 active:text-violet-600" @click="emit('reply', comment)">Ответить</button>
        <button v-if="comment.can_delete" class="shrink-0 px-1 py-1.5 active:text-red-500" @click="emit('remove', comment)">Удалить</button>
        <button v-if="hasKids()" class="shrink-0 px-1 py-1.5 font-semibold" @click="collapsed = !collapsed">{{ collapsed ? `Показать ветку (${totalKids()})` : 'Скрыть' }}</button>
      </div>
      <div v-if="!collapsed && hasKids()" class="mt-1.5 space-y-2.5 border-l-2 border-stone-200 pl-2.5 dark:border-zinc-700">
        <FlowCommentItem
          v-for="r in comment.replies"
          :key="r.id"
          :comment="r"
          :depth="depth + 1"
          :more="more"
          :loading="loading"
          @reply="emit('reply', $event)"
          @remove="emit('remove', $event)"
          @children="emit('children', $event)"
        />
        <Button
          v-if="more(comment)"
          :label="`Показать ответы (${hiddenKids()})`"
          link
          size="small"
          class="!text-xs !p-0"
          :loading="loading(comment)"
          @click="emit('children', comment)"
        />
      </div>
    </div>
  </div>
</template>
