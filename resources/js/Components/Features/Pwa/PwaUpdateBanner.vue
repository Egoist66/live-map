<script setup lang="ts">
import { usePwa } from '@/composables/usePwa'

const { needUpdate, online, applyUpdate, dismissUpdate } = usePwa()
</script>

<template>
  <Transition name="pwa-slide">
    <div
      v-if="needUpdate"
      class="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px)+0.5rem)] lg:bottom-6 left-1/2 -translate-x-1/2 z-[39] w-[calc(100%-1.5rem)] max-w-md"
      role="status"
    >
      <div class="glass rounded-2xl border border-stone-200/70 dark:border-white/10 shadow-xl dark:shadow-black/50 px-4 py-3 flex items-center gap-3 text-ink-900 dark:text-zinc-100">
        <i class="pi pi-refresh text-lg text-indigo-500 dark:text-indigo-400 shrink-0" />
        <p class="text-sm flex-1 min-w-0 font-medium">
          Доступна новая версия
          <span v-if="!online" class="block text-xs font-normal text-stone-500 dark:text-zinc-400">применится после появления сети</span>
        </p>
        <button class="text-xs font-semibold px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white active:scale-95 shrink-0" @click="applyUpdate">
          Обновить
        </button>
        <button class="p-2 text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-white/10 rounded-lg active:scale-95 shrink-0" aria-label="Позже" @click="dismissUpdate">
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
