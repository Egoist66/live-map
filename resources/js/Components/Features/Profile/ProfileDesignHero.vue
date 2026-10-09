<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import { useActivitySystem } from '@/composables/useActivitySystem'

const activity = useActivitySystem()

defineProps<{
  user: any
  avatarSrc: string
  online: boolean
  presenceText: string
  levelName: string
  planName: string
  reputationText: string
  emailText: string
  emailVerified?: boolean
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
  <section class="rounded-[20px] min-[411px]:rounded-[24px] border border-stone-200 bg-white shadow-soft p-3 min-[411px]:p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900 min-w-0 max-w-full overflow-hidden">
    <div class="flex gap-2.5 min-[411px]:gap-3 sm:gap-5 min-w-0">
      <div class="shrink-0">
        <button
          type="button"
          class="relative block h-[80px] w-[80px] min-[411px]:h-[104px] min-[411px]:w-[104px] sm:h-[128px] sm:w-[128px] overflow-hidden rounded-[18px] min-[411px]:rounded-[22px] bg-stone-200/70 dark:bg-zinc-800"
          aria-label="Открыть фото"
          @click="emit('avatar')"
        >
          <!-- LCP-элемент страницы: eager + fetchpriority, иначе Lighthouse
               `lcp-discovery-insight` штрафует. aria-label уходит в alt
               (аудит `image-alt`), размеры — против CLS.
               decoding sync + свой композитный слой: async-декод в старых
               WebView перерисовывает картинку при скролле — заглушка
               «моргает». -->
          <Avatar
            :image="avatarSrc"
            :aria-label="`Фото профиля ${user.name}`"
            shape="square"
            :pt="{ image: { fetchpriority: 'high', loading: 'eager', decoding: 'sync', width: 256, height: 256 } }"
            class="!h-full !w-full !rounded-[22px] [&_img]:!rounded-[22px] [&_img]:object-cover [&_img]:[transform:translateZ(0)]"
          />
          <OnlineDot
            :online="online"
            size="w-4 h-4 sm:w-5 sm:h-5"
          />
        </button>
      </div>

      <div class="min-w-0 flex-1">
        <h1 class="truncate text-[18px] min-[411px]:text-[22px] sm:text-2xl font-extrabold tracking-tight text-ink-900 dark:text-white">
          {{ user.name }}
        </h1>
        <p v-if="emailText" class="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] min-[411px]:text-[13px] text-stone-500 dark:text-zinc-400">
          <span class="truncate">{{ emailText }}</span>
          <i
            v-if="emailVerified"
            class="pi pi-verified shrink-0 text-[13px] text-emerald-500"
            title="Почта подтверждена"
            aria-label="Почта подтверждена"
          />
          <i
            v-else-if="isOwn"
            class="pi pi-exclamation-circle shrink-0 text-[13px] text-amber-500"
            title="Почта не подтверждена — проверь письмо со ссылкой"
            aria-label="Почта не подтверждена"
          />
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-1 min-[411px]:gap-1.5">
          <span v-if="activity.isReleased.value" class="rounded-full border border-stone-200 bg-stone-100 px-2.5 min-[411px]:px-3 py-1 text-[11px] min-[411px]:text-xs font-semibold text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 max-w-full truncate">{{ levelName }}</span>
          <span v-if="activity.isReleased.value" class="rounded-full border border-stone-200 bg-stone-100 px-2.5 min-[411px]:px-3 py-1 text-[11px] min-[411px]:text-xs font-semibold text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 max-w-full truncate">{{ reputationText }} ★</span>
          <span class="rounded-full border border-stone-200 bg-stone-100 px-2.5 min-[411px]:px-3 py-1 text-[11px] min-[411px]:text-xs font-semibold text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 max-w-full truncate">{{ planName }}</span>
        </div>
        <p class="mt-1.5 text-xs font-semibold" :class="online ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-zinc-400'">{{ presenceText }}</p>
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

      <div class="flex shrink-0 flex-col gap-1.5 min-[411px]:gap-2">
        <Link href="/map" class="block">
          <Button
            icon="pi pi-map"
            rounded
            outlined
            title="Открыть карту"
            aria-label="Открыть карту"
            class="!h-10 !w-10 min-[411px]:!h-11 min-[411px]:!w-11 !p-0 !rounded-full !border-stone-300 !text-stone-600 hover:!border-stone-400 dark:!border-zinc-700 dark:!text-zinc-200 dark:hover:!border-zinc-500"
            @click="emit('openMap')"
          />
        </Link>
        <Button
          v-if="isOwn"
          icon="pi pi-pencil"
          rounded
          title="Редактировать профиль"
          aria-label="Редактировать профиль"
          class="!h-10 !w-10 min-[411px]:!h-11 min-[411px]:!w-11 !p-0 !rounded-full !border-0 !bg-gradient-to-r !from-[#7c3aed] !to-[#3b82f6] !text-white hover:opacity-95"
          @click="emit('edit')"
        />
        <Button
          v-else-if="canMessage && !isBlocked"
          icon="pi pi-comments"
          :loading="loading"
          rounded
          title="Написать сообщение"
          aria-label="Написать сообщение"
          class="!h-10 !w-10 min-[411px]:!h-11 min-[411px]:!w-11 !p-0 !rounded-full !border-0 !bg-gradient-to-r !from-[#7c3aed] !to-[#3b82f6] !text-white hover:opacity-95"
          @click="emit('chat')"
        />
      </div>
    </div>
  </section>
</template>
