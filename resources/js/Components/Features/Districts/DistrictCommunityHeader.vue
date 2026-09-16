<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'
import Button from 'primevue/button'

const props = defineProps<{
  name: string
  avatarLetter: string
  typeLine: string
  membersCount: number
  pinsCount: number
  roleLabel: string | null
  roleTone: 'owner' | 'member' | 'pending' | 'invited' | null
  coverUrl: string | null
  canEditCover: boolean
  uploadingCover: boolean
}>()

const emit = defineEmits<{
  (e: 'edit-cover'): void
  (e: 'remove-cover'): void
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
    <div class="relative h-36 bg-stone-100 sm:h-52 dark:bg-zinc-800">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
      />
      <div
        v-else
        class="absolute inset-0 opacity-60 dark:opacity-40"
        style="background-image: radial-gradient(circle at 1px 1px, rgba(100,116,139,0.28) 1px, transparent 0); background-size: 18px 18px"
      />
      <div
        v-if="coverUrl"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent"
      />
      <i
        v-if="!coverUrl"
        class="pi pi-users absolute right-4 top-4 text-2xl text-stone-300 sm:text-3xl dark:text-zinc-700"
      />
      <div
        v-if="canEditCover"
        class="absolute bottom-3 right-3 flex items-center gap-2"
      >
        <Button
          :label="coverUrl ? 'Сменить' : 'Добавить обложку'"
          icon="pi pi-image"
          rounded
          size="small"
          :loading="uploadingCover"
          class="!border-0 !bg-black/55 !text-xs !font-bold !text-white backdrop-blur hover:!bg-black/70"
          @click="emit('edit-cover')"
        />
        <Button
          v-if="coverUrl"
          icon="pi pi-trash"
          rounded
          size="small"
          :loading="uploadingCover"
          title="Убрать обложку"
          aria-label="Убрать обложку"
          class="!h-8 !w-8 !border-0 !bg-black/55 !p-0 !text-white backdrop-blur hover:!bg-black/70"
          @click="emit('remove-cover')"
        />
      </div>
    </div>
    <div class="px-4 pb-4 sm:px-6 sm:pb-5">
      <div class="flex items-start gap-3 sm:gap-4">
        <div class="-mt-10 grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-white bg-blue-600 text-3xl font-black text-white shadow-soft sm:-mt-14 sm:h-28 sm:w-28 sm:rounded-3xl sm:text-4xl dark:border-zinc-900">
          {{ avatarLetter }}
        </div>
        <div class="min-w-0 flex-1 pt-2 sm:pt-3">
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
