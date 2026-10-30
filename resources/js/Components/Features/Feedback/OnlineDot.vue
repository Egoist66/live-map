<script setup lang="ts">
/**
 * Индикатор онлайна поверх аватарки.
 *
 * Позиция зашита внутри: всегда справа снизу НА САМОМ аватаре
 * (`bottom-0 right-0`, целиком внутри угла — одинаково на мобилке и десктопе).
 * Без выноса наружу: точку не режет `overflow-hidden` скруглённого аватара.
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
      'absolute bottom-0 right-0 pointer-events-none block shrink-0 rounded-full border-2 border-white shadow-sm dark:border-[#0F121F]',
      online ? 'bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]' : 'bg-red-500 animate-[pulse_2.8s_ease-in-out_infinite]',
      size || 'w-3.5 h-3.5',
    ]"
  />
</template>
