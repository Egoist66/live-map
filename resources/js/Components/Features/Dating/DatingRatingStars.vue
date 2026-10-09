<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    avg: number | null
    count?: number
    size?: 'sm' | 'md'
    /** dark — белый текст для фото-подложки; light — тёмный для светлых карточек */
    tone?: 'dark' | 'light'
  }>(),
  { count: 0, size: 'md', tone: 'dark' },
)

/**
 * Сколько звёзд заливать: среднее округляем до целой.
 */
const filled = computed(() => {
  if (props.avg == null) return 0
  return Math.round(props.avg)
})

const starClass = computed(() =>
  props.size === 'sm' ? 'text-[11px]' : 'text-sm',
)
</script>

<template>
  <span v-if="avg != null && (count ?? 0) > 0" class="inline-flex items-center gap-1" title="Рейтинг отзывов">
    <span class="inline-flex items-center gap-0.5 text-amber-400" aria-hidden="true">
      <i v-for="i in 5" :key="i" :class="[starClass, i <= filled ? 'pi pi-star-fill' : 'pi pi-star']" />
    </span>
    <span class="text-xs font-bold" :class="tone === 'dark' ? 'text-white/90' : 'text-stone-700 dark:text-zinc-200'">{{ avg.toFixed(1) }}</span>
    <span class="text-[11px]" :class="tone === 'dark' ? 'text-white/70' : 'text-stone-400 dark:text-zinc-500'">({{ count }})</span>
  </span>
</template>
