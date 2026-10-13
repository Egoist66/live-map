<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { computed } from 'vue'
import { refreshApp } from '@/composables/useBuildVersion'

/**
 * Плашка ошибки ленивой секции админки.
 *
 * Тяжёлые табы консоли грузятся отдельными чанками: после деплоя чанк
 * может 404-нуть (stale-импорт) — раньше это белило всю панель.
 * Теперь падает только секция: «Повторить» переимпортирует чанк,
 * «Обновить» чистит SW-кэши и прыгает на свежий билд.
 */
const props = defineProps<{
  /** Ошибка загрузчика (прокидывает defineAsyncComponent). */
  error?: unknown
  /** Повторный импорт чанка (прокидывает defineAsyncComponent). */
  retry?: () => void
}>()

const detail = computed(() => {
  if (props.error instanceof Error && props.error.message) {
    return props.error.message
  }

  return ''
})

/**
 * Повторно запросить чанк секции.
 */
function onRetry(): void {
  try {
    props.retry?.()
  } catch {
    // No-op: кнопка остаётся, можно нажать «Обновить».
  }
}
</script>

<template>
  <div class="rounded-3xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" role="alert">
    <Message severity="error" :closable="false" class="!rounded-2xl">
      Не удалось загрузить раздел консоли
      <template v-if="detail">
        <span class="mt-1 block text-xs opacity-70">{{ detail }}</span>
      </template>
    </Message>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button label="Повторить" icon="pi pi-refresh" rounded size="small" class="!border-0 !bg-[#1d2327] !font-bold !text-white dark:!bg-white dark:!text-stone-900" @click="onRetry()" />
      <Button label="Обновить страницу" icon="pi pi-download" link size="small" class="!text-xs" @click="refreshApp()" />
    </div>
  </div>
</template>
