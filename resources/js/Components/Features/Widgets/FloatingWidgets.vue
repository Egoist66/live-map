<script setup lang="ts">
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import { useFloatingWidgets } from '@/composables/useFloatingWidgets'

// Мобила: только розовая палочка сразу в AI-модалку.
// Десктоп: розовый виджет-панель (сообщения + UPin AI).
const w = useFloatingWidgets()
</script>
<template>
  <Button
    icon="pi pi-sparkles"
    rounded
    aria-label="AI-ассистент"
    class="lg:!hidden !fixed !z-40 !h-14 !w-14 !border-0 !bg-rose-500 !text-xl !text-white !shadow-lg right-4 bottom-[calc(var(--app-bottomnav)+var(--sab)+1rem)]"
    @click="w.openAssistant()"
  />
  <div class="fixed bottom-5 right-5 z-40 hidden flex-col items-end gap-2 lg:flex">
    <Transition name="widget-pop">
      <div
        v-if="w.isPanelOpen.value"
        role="menu"
        aria-label="Виджеты"
        class="w-60 overflow-hidden rounded-3xl border border-stone-200 bg-white p-1.5 shadow-float dark:border-zinc-700 dark:bg-zinc-900"
      >
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-stone-100 dark:hover:bg-zinc-800"
          @click="w.openMessages()"
        >
          <span class="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ink-900 text-white dark:bg-white dark:text-ink-900">
            <i class="pi pi-comments text-base"></i>
            <span
              v-if="w.unreadLabel.value"
              class="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900"
            >
              {{ w.unreadLabel.value }}
            </span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-black dark:text-white">Сообщения</span>
            <span class="block truncate text-xs text-stone-500 dark:text-zinc-400">быстрые чаты</span>
          </span>
          <i class="pi pi-angle-right shrink-0 text-xs text-stone-400"></i>
        </button>
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-stone-100 dark:hover:bg-zinc-800"
          @click="w.openAssistant()"
        >
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-500 text-sm font-black text-white">
            AI
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-black dark:text-white">UPin AI</span>
            <span class="block truncate text-xs text-stone-500 dark:text-zinc-400">гид по приложению</span>
          </span>
          <i class="pi pi-angle-right shrink-0 text-xs text-stone-400"></i>
        </button>
      </div>
    </Transition>
    <div class="relative">
      <Button
        :icon="w.isPanelOpen.value ? 'pi pi-times' : 'pi pi-comments'"
        rounded
        :aria-label="w.isPanelOpen.value ? 'Закрыть виджеты' : 'Открыть виджеты'"
        :aria-expanded="w.isPanelOpen.value"
        class="!h-14 !w-14 !border-0 !bg-rose-500 !text-xl !text-white !shadow-lg"
        @click="w.togglePanel()"
      />
      <Badge
        v-if="w.unreadLabel.value && !w.isPanelOpen.value"
        :value="w.unreadLabel.value"
        severity="danger"
        class="absolute -right-1 -top-1 !min-w-6 !rounded-full"
      />
    </div>
  </div>
</template>
<style scoped>
.widget-pop-enter-active { transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: bottom right; }
.widget-pop-leave-active { transition: all 0.16s ease; transform-origin: bottom right; }
.widget-pop-enter-from { opacity: 0; transform: scale(0.9) translateY(8px); }
.widget-pop-leave-to { opacity: 0; transform: scale(0.95) translateY(4px); }
</style>
