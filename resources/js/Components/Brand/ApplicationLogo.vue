<script setup lang="ts">
import BrandMark from './BrandMark.vue'

/**
 * Логотип приложения в шапке (гость/кабинет бизнеса).
 *
 * Текстовое обозначение названия рядом с маркой НЕ рендерим: wordmark
 * «ULove» уже нарисован в самой BrandMark, дубликат в шапке только шумел.
 * `pro` добавляет бейдж тарифа (кабинет бизнеса).
 */
withDefaults(defineProps<{ pro?: boolean }>(), { pro: false })
</script>
<template>
  <div class="flex items-center gap-1.5">
    <span
      class="grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] shadow-soft shrink-0 min-[411px]:h-9 min-[411px]:w-9 min-[411px]:rounded-xl"
    >
      <BrandMark class="h-full w-full" />
    </span>
    <span
      v-if="pro"
      class="font-black text-[11px] min-[411px]:text-[12px] tracking-wide bg-gradient-to-r from-indigo-500 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent"
    >Pro</span>
  </div>
</template>
