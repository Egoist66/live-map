<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'

const props = withDefaults(
  defineProps<{
    // Ref из useInfiniteScroll (в шаблоне разворачивается в HTMLElement|null),
    // колбэк-сеттер или null — всё принимается, чтобы не ломать типы шаблонов.
    sentinel: unknown
    hasMore: boolean
    loading: boolean
    endText?: string
  }>(),
  { endText: '' },
)

function setRef(el: unknown): void {
  const target = props.sentinel as
    | { value: HTMLElement | null }
    | ((el: unknown) => void)
    | null
    | undefined

  if (typeof target === 'function') {
    target(el)
    return
  }

  if (target && typeof target === 'object' && 'value' in target) {
    target.value = el as HTMLElement | null
  }
}
</script>

<template>
  <div class="infinite-sentinel">
    <div :ref="setRef" class="infinite-sentinel__anchor" aria-hidden="true" />
    <div v-if="loading" class="flex justify-center py-4">
      <ProgressSpinner :style="{ width: '32px', height: '32px' }" :stroke-width="5" aria-label="Загрузка" />
    </div>
    <div v-else-if="!hasMore && endText" class="py-3 text-center text-xs text-stone-400 dark:text-zinc-500">
      {{ endText }}
    </div>
  </div>
</template>

<style scoped>
.infinite-sentinel__anchor {
  width: 100%;
  height: 1px;
}
</style>
