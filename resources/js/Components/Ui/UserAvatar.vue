<script setup lang="ts">
import { computed } from 'vue'
import Avatar from 'primevue/avatar'

// Аватар с гардом: есть фото — PrimeVue Avatar, нет —
// инлайн-SVG с силуэтом человека (currentColor под тему,
// фон через Tailwind-классы родителя/дефолт ниже).
// Размер и скругление задаёт родитель через class:
// компонент растягивается на 100% контейнера.
const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    shape?: 'circle' | 'square'
  }>(),
  { src: null, alt: 'Фото профиля', shape: 'circle' },
)

const isPlaceholder = computed(() => {
  const src = (props.src ?? '').trim()
  return src === '' || src.startsWith('data:image/svg')
})
</script>
<template>
  <Avatar
    v-if="!isPlaceholder"
    :image="(src as string)"
    :aria-label="alt"
    :shape="shape"
    class="!h-full !w-full [&_img]:!h-full [&_img]:!w-full [&_img]:object-cover"
  />
  <span
    v-else
    role="img"
    :aria-label="alt"
    class="grid h-full w-full place-items-center overflow-hidden rounded-[inherit] bg-stone-200 text-stone-400 dark:bg-zinc-700 dark:text-zinc-400"
  >
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" class="h-3/5 w-3/5">
      <circle cx="32" cy="22" r="11" />
      <path d="M13 51c3-10 10-15 19-15s16 5 19 15v2H13z" />
    </svg>
  </span>
</template>
