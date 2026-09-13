<script setup lang="ts">
import Button from 'primevue/button'
import { useAppRefreshBanner } from '@/composables/useAppRefreshBanner'

const { visible, isBuildUpdate, busy, online, apply, dismiss } = useAppRefreshBanner()
</script>

<template>
  <Transition name="pwa-slide">
    <div
      v-if="visible"
      class="fixed bottom-[calc(var(--app-bottomnav)+var(--sab)+0.5rem)] lg:bottom-6 left-1/2 -translate-x-1/2 z-[39] w-[calc(100%-1.5rem)] max-w-md"
      role="status"
    >
      <div class="glass rounded-2xl border border-stone-200/70 dark:border-white/10 shadow-xl dark:shadow-black/50 px-4 py-3 flex items-center gap-3 text-ink-900 dark:text-zinc-100">
        <i class="pi pi-refresh text-lg text-indigo-500 dark:text-indigo-400 shrink-0" />
        <p class="text-sm flex-1 min-w-0 font-medium">
          {{ isBuildUpdate ? 'Вышло обновление — нажмите, чтобы обновить' : 'Доступна новая версия' }}
          <span v-if="!online" class="block text-xs font-normal text-stone-500 dark:text-zinc-400">применится после появления сети</span>
        </p>
        <Button size="small" :loading="busy" :disabled="!online" label="Обновить" icon="pi pi-refresh" class="!rounded-xl !text-xs" @click="apply" />
        <Button size="small" text rounded aria-label="Позже" icon="pi pi-times" class="!shrink-0" @click="dismiss" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-slide-enter-active, .pwa-slide-leave-active { transition: transform .3s ease, opacity .3s ease; }
.pwa-slide-enter-from, .pwa-slide-leave-to { transform: translate(-50%, 12px); opacity: 0; }
</style>
