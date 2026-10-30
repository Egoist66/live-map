<script setup lang="ts">
import Skeleton from 'primevue/skeleton'

/**
 * Скелет ленивой секции админки на время подгрузки чанка.
 */
</script>

<template>
  <div class="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2" aria-hidden="true">
    <div class="rounded-3xl border border-stone-200 bg-white p-5 dark:border-white/10 dark:bg-[#0F121F]">
      <Skeleton width="12rem" height="1.5rem" class="rounded-lg" />
      <Skeleton width="100%" height="8rem" class="mt-4 rounded-2xl" />
      <div class="mt-3 flex gap-2">
        <Skeleton width="6rem" height="2.25rem" class="rounded-full" />
        <Skeleton width="6rem" height="2.25rem" class="rounded-full" />
      </div>
    </div>
    <div class="hidden rounded-3xl border border-stone-200 bg-white p-5 xl:block dark:border-white/10 dark:bg-[#0F121F]">
      <Skeleton width="10rem" height="1.5rem" class="rounded-lg" />
      <Skeleton width="100%" height="8rem" class="mt-4 rounded-2xl" />
    </div>
  </div>
</template>
