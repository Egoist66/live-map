<script setup lang="ts">
import Button from 'primevue/button'
import { useNetworkToast } from '@/composables/useNetworkToast'

const { isOffline, showRestored, dismissRestored } = useNetworkToast()
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-bottomnav,0px)+var(--sab,0px)+1rem)] lg:bottom-6 z-[9990] flex flex-col items-center gap-2 px-4"
    aria-live="polite"
  >
    <Transition name="network-toast">
      <div
        v-if="isOffline"
        role="status"
        class="pointer-events-auto w-full max-w-md rounded-2xl border border-red-200/80 bg-white/95 px-4 py-3 shadow-[0_16px_48px_rgba(220,38,38,0.28)] backdrop-blur-xl dark:border-red-500/20 dark:bg-[#1B1216]/95 dark:shadow-black/60"
      >
        <div class="flex items-center gap-3">
          <span class="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30">
            <i class="pi pi-wifi text-base"></i>
            <span class="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-[#1B1216]"></span>
            <span class="absolute -right-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-red-400 opacity-60"></span>
          </span>
          <p class="min-w-0 flex-1 text-sm">
            <span class="block font-bold text-red-600 dark:text-red-400">Нет соединения с интернетом</span>
            <span class="mt-0.5 block text-xs leading-relaxed text-stone-500 dark:text-zinc-400">Проверьте сеть — переподключимся автоматически<span class="dots" aria-hidden="true"></span></span>
          </p>
        </div>
      </div>
    </Transition>

    <Transition name="network-toast">
      <div
        v-if="!isOffline && showRestored"
        role="status"
        class="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-200/80 bg-white/95 px-4 py-3 shadow-[0_16px_48px_rgba(16,185,129,0.28)] backdrop-blur-xl dark:border-emerald-500/20 dark:bg-[#0F1B16]/95 dark:shadow-black/60"
      >
        <div class="flex items-center gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
            <i class="pi pi-check text-base"></i>
          </span>
          <p class="min-w-0 flex-1 text-sm">
            <span class="block font-bold text-emerald-600 dark:text-emerald-400">Соединение восстановлено</span>
            <span class="mt-0.5 block text-xs leading-relaxed text-stone-500 dark:text-zinc-400">Сеть снова в порядке — можно продолжать</span>
          </p>
          <Button icon="pi pi-times" text rounded size="small" aria-label="Закрыть уведомление" class="!shrink-0" @click="dismissRestored" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.network-toast-enter-active {
  transition:
    transform 0.38s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.32s ease;
}
.network-toast-leave-active {
  transition:
    transform 0.26s ease,
    opacity 0.24s ease;
}
.network-toast-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.96);
}
.network-toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
.dots::after {
  content: '';
  animation: dots 1.4s steps(4, end) infinite;
}
@keyframes dots {
  0% {
    content: '';
  }
  25% {
    content: '.';
  }
  50% {
    content: '..';
  }
  75% {
    content: '...';
  }
}
</style>
