<script setup lang="ts">
/**
 * Индикатор онлайна поверх аватарки.
 *
 * Чисто визуальная точка, без позиционирования — положение
 * задаёт родитель через `class` (`absolute bottom-… right-…`).
 * Родитель обязан быть `relative`.
 *
 * @example
 * <span class="relative shrink-0">
 *   <Avatar :image="src" shape="circle" />
 *   <OnlineDot :online="isOnline" class="absolute -bottom-0.5 -right-0.5" />
 * </span>
 */
defineProps<{ online: boolean; size?: string }>()
</script>
<template>
  <span
    :class="[
      'pointer-events-none grid shrink-0 place-items-center rounded-full border-2 border-white shadow-sm dark:border-zinc-900',
      online ? 'bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]' : 'bg-red-500 animate-[pulse_2.8s_ease-in-out_infinite]',
      size || 'w-3.5 h-3.5',
    ]"
  >
    <span class="h-[32%] w-[32%] rounded-full bg-white/90"></span>
  </span>
</template>
