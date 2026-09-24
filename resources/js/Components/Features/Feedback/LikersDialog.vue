<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { reactionEmoji, type LikerItem } from '@/composables/useLikersPreview'
import { useProfileUrl } from '@/composables/useProfileUrl'

defineProps<{ visible: boolean; title: string; likers: LikerItem[]; loading: boolean; total: number; showType?: boolean; baseZIndex?: number }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const { userProfileUrl } = useProfileUrl()

function initialOf(name: string): string {
  return (name || '?').slice(0, 1).toUpperCase()
}
</script>
<template>
  <Dialog
    :visible="visible"
    @update:visible="(v: boolean) => emit('update:visible', v)"
    modal
    :draggable="false"
    :closable="false"
    :base-z-index="baseZIndex ?? 0"
    :style="{ width: '360px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{ root: { class: '!rounded-[24px] !border-stone-200 dark:!border-zinc-800 overflow-hidden' }, header: { class: '!p-0 !border-0' }, content: { class: '!p-0 !bg-white dark:!bg-zinc-900' } }"
  >
    <template #header>
      <div class="w-full flex items-center gap-2 px-5 pt-5 pb-3">
        <span class="w-9 h-9 rounded-full bg-rose-500 grid place-items-center text-white shadow shrink-0"><i class="pi pi-heart-fill text-sm"></i></span>
        <div class="min-w-0 flex-1">
          <div class="text-[15px] font-black dark:text-white leading-none">{{ title }}</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400 mt-1">{{ total }}</div>
        </div>
        <Button icon="pi pi-times" rounded text size="small" class="!w-8 !h-8 shrink-0 !border-0 !shadow-none" @click="emit('update:visible', false)" aria-label="Закрыть" />
      </div>
    </template>
    <div class="px-3 pb-[calc(0.75rem+var(--sab))]">
      <div v-if="loading" class="py-8 grid place-items-center"><ProgressSpinner class="!w-7 !h-7" /></div>
      <div v-else-if="!likers.length" class="py-8 text-center text-xs text-stone-400">Пока никто не лайкнул</div>
      <div v-else class="max-h-[50dvh] overflow-y-auto overscroll-contain space-y-0.5">
        <component
          :is="l.user_id ? Link : 'div'"
          v-for="l in likers"
          :key="`${l.user_id ?? 'inc'}-${l.name}`"
          :href="l.user_id ? userProfileUrl(l) : undefined"
          class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-2xl text-left transition hover:bg-stone-100 dark:hover:bg-zinc-800"
        >
          <img v-if="l.avatar_url" :src="l.avatar_url" alt="" loading="lazy" class="w-9 h-9 rounded-full object-cover shrink-0 bg-stone-100 dark:bg-white/10" />
          <span v-else class="w-9 h-9 rounded-full bg-stone-200 dark:bg-white/10 grid place-items-center text-xs font-black text-stone-600 dark:text-zinc-200 shrink-0 overflow-hidden">{{ l.is_incognito ? '🕵️' : initialOf(l.name) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13px] font-bold truncate dark:text-zinc-100">{{ l.name }}</span>
            <span v-if="l.is_incognito" class="block text-[10px] font-bold text-violet-500">PRO · инкогнито</span>
          </span>
          <span v-if="showType && reactionEmoji(l.type)" class="text-base shrink-0">{{ reactionEmoji(l.type) }}</span>
        </component>
      </div>
    </div>
  </Dialog>
</template>
