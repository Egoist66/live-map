<script setup lang="ts">
import { ref } from 'vue'
import { usePwa } from '@/composables/usePwa'

const { canInstall, standalone, promptInstall } = usePwa()
const dismissed = ref(sessionStorage.getItem('pwa-install-dismissed') === '1')

async function install(): Promise<void> {
  const outcome = await promptInstall()
  if (outcome !== 'unavailable') dismiss()
}

function dismiss(): void {
  dismissed.value = true
  try {
    sessionStorage.setItem('pwa-install-dismissed', '1')
  } catch {}
}
</script>

<template>
  <Transition name="pwa-slide">
    <div
      v-if="canInstall && !standalone && !dismissed"
      class="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px)+0.5rem)] lg:bottom-6 left-1/2 -translate-x-1/2 z-[39] w-[calc(100%-1.5rem)] max-w-md"
      role="dialog"
      aria-label="Установить приложение"
    >
      <div class="rounded-2xl bg-[#0F172A] text-white shadow-xl px-4 py-3 flex items-center gap-3">
        <img src="/pwa-192x192.png" alt="" class="w-10 h-10 rounded-xl shrink-0" />
        <p class="text-sm flex-1">
          <span class="font-semibold">Установить UPin</span>
          <span class="block text-xs opacity-60">как приложение: быстрее и на весь экран</span>
        </p>
        <button class="text-xs font-semibold px-3 py-2 rounded-xl bg-white text-zinc-900 active:scale-95" @click="install">
          Установить
        </button>
        <button class="p-2 opacity-60 active:scale-95" aria-label="Закрыть" @click="dismiss">
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
