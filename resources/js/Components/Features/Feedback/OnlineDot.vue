<script setup lang="ts">
/**
 * Индикатор онлайна поверх аватарки.
 *
 * Позиция зашита внутри: всегда справа снизу аватара
 * (`bottom-0 right-0` + вынос на четверть точки наружу).
 * Сдвиг в процентах от размера самой точки, поэтому одинаков
 * на любом разрешении и размере аватара.
 * Родитель обязан быть `relative`. Позицию через `class` не передавать.
 *
 * @example
 * <span class="relative shrink-0">
 *   <Avatar :image="src" shape="circle" />
 *   <OnlineDot :online="isOnline" />
 * </span>
 */
defineProps<{ online: boolean; size?: string }>()
</script>
<template>
  <span
    :class="[
      'absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 pointer-events-none grid shrink-0 place-items-center rounded-full border-2 border-white shadow-sm dark:border-zinc-900',
      online ? 'bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]' : 'bg-red-500 animate-[pulse_2.8s_ease-in-out_infinite]',
      size || 'w-3.5 h-3.5',
    ]"
  >
    <span class="h-[32%] w-[32%] rounded-full bg-white/90"></span>
  </span>
</template>
