<script setup lang="ts">
import { usePwaInstallBanner } from '@/composables/usePwaInstallBanner'

const { canInstall, standalone, dismissed, install, dismiss } = usePwaInstallBanner()
</script>

<template>
  <Transition name="pwa-slide">
    <div
      v-if="canInstall && !standalone && !dismissed"
      class="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px)+0.5rem)] lg:bottom-6 left-1/2 -translate-x-1/2 z-[39] w-[calc(100%-1.5rem)] max-w-md"
      role="dialog"
      aria-label="Установить приложение"
    >
      <div class="rounded-2xl bg-white dark:bg-[#151B2E] text-ink-900 dark:text-white border border-stone-200/70 dark:border-white/10 shadow-xl dark:shadow-black/50 px-4 py-3 flex items-center gap-3">
        <img src="/pwa-192x192.png" alt="" class="w-10 h-10 rounded-xl shrink-0 bg-stone-100 dark:bg-white/10" />
        <p class="text-sm flex-1 min-w-0">
          <span class="font-semibold">Установить UPin</span>
          <span class="block text-xs text-stone-500 dark:text-zinc-400">как приложение: быстрее и на весь экран</span>
        </p>
        <button class="text-xs font-semibold px-3 py-2 rounded-xl bg-ink-900 dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] hover:opacity-90 active:scale-95 shrink-0" @click="install">
          Установить
        </button>
        <button class="p-2 text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg active:scale-95 shrink-0" aria-label="Закрыть" @click="dismiss">
          <i class="pi pi-times text-sm" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-slide-enter-active, .pwa-slide-leave-active { transition: transform .3s ease, opacity .3s ease; }
.pwa-slide-enter-from, .pwa-slide-leave-to { transform: translate(-50%, 12px); opacity: 0; }
</style>
