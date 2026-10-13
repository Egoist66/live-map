<script setup lang="ts">
import Skeleton from 'primevue/skeleton'

/**
 * Скелетон карточки свайпа: геометрия 1-в-1 как у колоды.
 *
 * Высотные классы продублированы с `.swipe-deck` из `Swipes.vue`
 * (`sm:h-[60dvh] … 2xl:max-h-[740px]`), на мобиле — тот же flex-рост
 * через `.swipes-feed-skeleton`. Поэтому замена «скелетон → карточка»
 * или «скелетон → панель “всех просвайпал”» не двигает топбар и стрип.
 * Кнопки-призраки лежат там же, где `SwipeActionsBar` (оверлей bottom-3).
 */
</script>

<template>
  <div
    role="status"
    aria-busy="true"
    aria-label="Загружаем анкеты"
    class="swipes-feed-skeleton relative overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:h-[60dvh] sm:min-h-[380px] sm:max-h-[520px] lg:h-[62dvh] lg:max-h-[600px] xl:h-[66dvh] xl:max-h-[680px] 2xl:max-h-[740px]"
  >
    <Skeleton width="100%" height="100%" border-radius="0" class="!absolute !inset-0" />

    <div class="absolute inset-x-0 top-0 px-2.5 pt-2.5" aria-hidden="true">
      <div class="flex gap-1.5">
        <Skeleton width="100%" height="4px" border-radius="999px" />
        <Skeleton width="100%" height="4px" border-radius="999px" class="opacity-60" />
        <Skeleton width="100%" height="4px" border-radius="999px" class="opacity-40" />
      </div>
    </div>

    <div class="absolute inset-x-0 bottom-0 px-4 pb-24 pt-4 sm:px-5" aria-hidden="true">
      <div class="flex items-baseline gap-2">
        <Skeleton width="11rem" height="1.75rem" border-radius="8px" />
        <Skeleton width="3rem" height="1.25rem" border-radius="8px" />
      </div>
      <Skeleton width="9rem" height="1rem" border-radius="8px" class="mt-2" />
      <div class="mt-2 flex gap-1.5">
        <Skeleton width="4.5rem" height="1.5rem" border-radius="999px" />
        <Skeleton width="3.5rem" height="1.5rem" border-radius="999px" />
        <Skeleton width="5rem" height="1.5rem" border-radius="999px" class="max-sm:hidden" />
      </div>
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-3 px-4 sm:bottom-4" aria-hidden="true">
      <Skeleton shape="circle" size="3.5rem" />
      <Skeleton shape="circle" size="3.5rem" />
      <Skeleton shape="circle" size="4.5rem" />
      <Skeleton shape="circle" size="3.5rem" />
    </div>
  </div>
</template>
