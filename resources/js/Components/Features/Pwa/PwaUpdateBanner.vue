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
      <div class="glass rounded-2xl border border-stone-200/70 dark:border-zinc-700 shadow-xl px-4 py-3 flex items-center gap-3">
        <i class="pi pi-refresh text-lg text-indigo-500 shrink-0" />
        <p class="text-sm flex-1">
          Доступна новая версия
          <span v-if="!online" class="block text-xs opacity-60">применится после появления сети</span>
        </p>
        <button class="text-xs font-semibold px-3 py-2 rounded-xl bg-indigo-500 text-white active:scale-95" @click="applyUpdate">
          Обновить
        </button>
        <button class="p-2 opacity-60 active:scale-95" aria-label="Позже" @click="dismissUpdate">
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
