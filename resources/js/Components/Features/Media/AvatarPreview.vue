<script setup lang="ts">
import { useAvatarPreview } from '@/composables/useAvatarPreview'
const props = defineProps<{ src: string; name?: string; open: boolean }>()
const emit = defineEmits<{ (e:'close'):void }>()
useAvatarPreview(() => props.open, () => emit('close'))
</script>
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6 overflow-y-auto overscroll-contain" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-ink-900/70 dark:bg-black/80 backdrop-blur-sm" @click="emit('close')"></div>
        <Transition name="zoom" appear>
          <div class="relative pointer-events-auto bg-white dark:bg-zinc-900 rounded-[24px] p-2 shadow-float border border-white/20 dark:border-zinc-700 w-[min(90vw,520px)] max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
            <img :src="src" :alt="name||'avatar'" class="w-full h-[min(70vw,380px,52dvh)] max-h-[52dvh] object-cover object-center rounded-[16px] bg-stone-100 dark:bg-zinc-800" />
            <div class="flex items-center justify-between gap-4 px-2 py-3 shrink-0">
              <div class="min-w-0">
                <div class="text-sm font-bold dark:text-white truncate">{{ name || 'Фото профиля' }}</div>
              </div>
            </div>
            <button @click="emit('close')" class="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/95 dark:bg-zinc-800/95 border border-stone-200 dark:border-zinc-700 shadow-soft grid place-items-center hover:bg-stone-50 dark:hover:bg-zinc-700 transition text-stone-600 dark:text-zinc-300">✕</button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
<style scoped>
.fade-enter-active,.fade-leave-active{transition:opacity .2s}
.fade-enter-from,.fade-leave-to{opacity:0}
.zoom-enter-active{transition:all .32s cubic-bezier(.16,1,.3,1)}
.zoom-leave-active{transition:all .2s ease}
.zoom-enter-from{opacity:0; transform:scale(.92) translateY(8px)}
.zoom-leave-to{opacity:0; transform:scale(.96)}
</style>
