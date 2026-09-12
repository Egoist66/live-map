<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'

defineProps<{
  user: any
  avatarSrc: string
  online: boolean
  levelName: string
  planName: string
  reputationText: string
  emailText: string
  headlineText: string
  canEditThought: boolean
  isOwn: boolean
  canMessage: boolean
  isBlocked: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'avatar'): void
  (e: 'openMap'): void
  (e: 'chat'): void
  (e: 'edit'): void
  (e: 'editThought'): void
}>()
</script>

<template>
  <section class="rounded-[24px] border border-stone-200 bg-white shadow-soft p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex gap-3 sm:gap-5">
      <div class="relative shrink-0">
        <button
          type="button"
          class="block h-[104px] w-[104px] sm:h-[128px] sm:w-[128px] overflow-hidden rounded-[22px] bg-stone-200/70 dark:bg-zinc-800"
          aria-label="Открыть фото"
          @click="emit('avatar')"
        >
          <Avatar
            :image="avatarSrc"
            shape="square"
            class="!h-full !w-full !rounded-[22px] [&_img]:!rounded-[22px] [&_img]:object-cover"
          />
        </button>
        <OnlineDot
          :online="online"
          size="w-4 h-4 sm:w-5 sm:h-5"
        />
      </div>

      <div class="min-w-0 flex-1">
        <h1 class="truncate text-[22px] sm:text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">
          {{ user.name }}
        </h1>
        <p v-if="emailText" class="mt-0.5 truncate text-[13px] text-stone-500 dark:text-zinc-400">{{ emailText }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <span class="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{{ levelName }}</span>
          <span class="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{{ reputationText }} ★</span>
          <span class="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{{ planName }}</span>
        </div>
        <p v-if="headlineText" class="mt-2 flex min-w-0 items-center gap-1 text-[13px] italic text-stone-500 dark:text-zinc-400">
          <span class="truncate">{{ headlineText }} <span class="not-italic">✦</span></span>
          <button
            v-if="canEditThought"
            type="button"
            title="Изменить мысль"
            aria-label="Изменить мысль"
            class="grid h-5 w-5 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 active:scale-95 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200"
            @click="emit('editThought')"
          >
            <i class="pi pi-pencil text-[10px]"></i>
          </button>
        </p>
        <button
          v-else-if="canEditThought"
          type="button"
          class="mt-2 inline-flex items-center gap-1 text-[13px] text-stone-400 transition hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          @click="emit('editThought')"
        >
          <i class="pi pi-plus text-[10px]"></i> Добавить мысль
        </button>
      </div>

      <div class="flex shrink-0 flex-col gap-2">
        <Link href="/map" class="block">
          <Button
            icon="pi pi-map"
            rounded
            outlined
            title="Открыть карту"
            aria-label="Открыть карту"
            class="!h-11 !w-11 !p-0 !rounded-full !border-stone-300 !text-stone-600 hover:!border-stone-400 dark:!border-zinc-700 dark:!text-zinc-200 dark:hover:!border-zinc-500"
            @click="emit('openMap')"
          />
        </Link>
        <Button
          v-if="isOwn"
          icon="pi pi-pencil"
          rounded
          title="Редактировать профиль"
          aria-label="Редактировать профиль"
          class="!h-11 !w-11 !p-0 !rounded-full !border-0 !bg-gradient-to-r !from-[#7c3aed] !to-[#3b82f6] !text-white hover:opacity-95"
          @click="emit('edit')"
        />
        <Button
          v-else-if="canMessage && !isBlocked"
          icon="pi pi-comments"
          :loading="loading"
          rounded
          title="Написать сообщение"
          aria-label="Написать сообщение"
          class="!h-11 !w-11 !p-0 !rounded-full !border-0 !bg-gradient-to-r !from-[#7c3aed] !to-[#3b82f6] !text-white hover:opacity-95"
          @click="emit('chat')"
        />
      </div>
    </div>
  </section>
</template>
