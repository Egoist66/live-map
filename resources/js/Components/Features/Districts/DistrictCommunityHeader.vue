<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'

const props = defineProps<{
  name: string
  avatarLetter: string
  typeLine: string
  membersCount: number
  pinsCount: number
  roleLabel: string | null
  roleTone: 'owner' | 'member' | 'pending' | 'invited' | null
}>()

const roleClass = computed(() => {
  if (props.roleTone === 'owner') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  }
  if (props.roleTone === 'member') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (props.roleTone === 'pending') {
    return 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-zinc-300'
  }
  if (props.roleTone === 'invited') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
  }
  return ''
})
</script>

<template>
  <div class="overflow-hidden rounded-3xl border border-stone-200/70 bg-white dark:border-zinc-800 dark:bg-zinc-900">
    <div class="relative h-28 bg-stone-100 sm:h-44 dark:bg-zinc-800">
      <div
        class="absolute inset-0 opacity-60 dark:opacity-40"
        style="background-image: radial-gradient(circle at 1px 1px, rgba(100,116,139,0.28) 1px, transparent 0); background-size: 18px 18px"
      />
      <i class="pi pi-users absolute right-4 top-4 text-2xl text-stone-300 sm:text-3xl dark:text-zinc-700" />
    </div>
    <div class="px-4 pb-4 sm:px-6 sm:pb-5">
      <div class="flex items-start gap-3 sm:gap-4">
        <div class="-mt-8 grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-blue-600 text-2xl font-black text-white shadow-soft sm:-mt-10 sm:h-24 sm:w-24 sm:rounded-3xl sm:text-4xl">
          {{ avatarLetter }}
        </div>
        <div class="min-w-0 flex-1 pt-1">
          <h1 class="truncate text-lg font-black tracking-tight text-ink-900 sm:text-2xl dark:text-white">
            {{ name }}
          </h1>
          <p class="mt-0.5 truncate text-xs text-stone-500 sm:text-[13px] dark:text-zinc-400">
            {{ typeLine }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag :value="`${membersCount} уч.`" rounded class="!border-0 !bg-stone-100 !text-[11px] !font-bold !text-stone-600 dark:!bg-white/10 dark:!text-zinc-200" />
            <Tag :value="`${pinsCount} пин.`" rounded class="!border-0 !bg-stone-100 !text-[11px] !font-bold !text-stone-600 dark:!bg-white/10 dark:!text-zinc-200" />
            <span v-if="roleLabel" :class="['rounded-full px-2.5 py-1 text-[11px] font-bold', roleClass]">
              {{ roleLabel }}
            </span>
          </div>
        </div>
      </div>
      <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
