<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { route } from '@/route'
import ProfileFlowPosts from '@/Components/Features/Flow/ProfileFlowPosts.vue'

defineProps<{
  userId: number
  isOwn: boolean
}>()

/** Переход в полную ленту UFlow. */
function goFullFeed(): void {
  router.visit(route('flow'))
}
</script>

<template>
  <section class="relative overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-soft p-4 sm:p-5 dark:border-fuchsia-500/20 dark:bg-zinc-900 dark:shadow-[0_0_48px_-12px_rgba(139,92,246,0.35)]">
    <span class="pointer-events-none absolute inset-x-5 top-0 h-[3px] rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-fuchsia-500"></span>
    <div class="flex items-center justify-between">
      <h2 class="flex items-center gap-2 text-lg sm:text-xl font-extrabold tracking-tight">
        <span class="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-600 to-fuchsia-500 text-white"><i class="pi pi-th-large text-sm"></i></span>
        <span class="bg-gradient-to-r from-sky-600 via-blue-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-sky-400 dark:via-blue-400 dark:to-fuchsia-400">UFlow</span>
      </h2>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-500 transition hover:text-ink-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        @click="goFullFeed()"
      >
        Вся лента <i class="pi pi-arrow-right text-xs"></i>
      </button>
    </div>
    <div class="mt-3 rounded-2xl border border-stone-200 bg-stone-200/50 p-2 sm:p-3 dark:border-transparent dark:bg-black/25">
      <ProfileFlowPosts :user-id="userId" :is-own="isOwn" :show-header="false" :limit="2" :preview-modal="true" />
    </div>
  </section>
</template>
