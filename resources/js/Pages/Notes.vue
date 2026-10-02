<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { useSeo } from '@/composables/useSeo'
import { usePageScrollLock } from '@/composables/usePageScrollLock'
import SavedNotesChat from '@/Components/Features/Chat/SavedNotesChat.vue'

/**
 * «Избранное» — чат только для себя на весь экран.
 * Та же механика, что у диалога с человеком: пузырьки, вложения,
 * поиск и композер. Скролл страницы заперт (usePageScrollLock),
 * листается только лента внутри.
 */
usePageScrollLock()

const seo = useSeo({
  title: 'ULove — избранное',
  description: 'Избранное — чат с собой: мысли, ссылки, картинки и файлы. Синхронизация между устройствами.',
  keywords: ['ULove', 'избранное', 'заметки'],
})

/**
 * Назад — туда, откуда открыли (обычно из чатов).
 */
function goBack(): void {
  try {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
  } catch {
    /* noop */
  }
  router.visit('/chat')
}
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
  </Head>
  <div class="mx-auto max-w-[1280px] w-full min-w-0 overflow-hidden overscroll-none p-0 lg:px-6 lg:py-4">
    <div class="h-app-full flex flex-col w-full min-w-0 overflow-hidden overscroll-contain bg-transparent">
      <SavedNotesChat show-back @back="goBack" />
    </div>
  </div>
</template>
