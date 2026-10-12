<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMounted } from '@vueuse/core'
import { useAvatarPreview } from '@/composables/useAvatarPreview'
import { useSwipeToClose } from '@/composables/useSwipeToClose'

const props = defineProps<{ src?: string | null; name?: string; open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

// Teleport к body создаём только после mount: во время SSR-гидратации
// `Teleport.process` с несовпавшим контентом даёт `insertBefore of null`.
const isMounted = useMounted()

useAvatarPreview(() => props.open, () => emit('close'))

const cardRef = ref<HTMLElement | null>(null)
useSwipeToClose(cardRef, { onClose: () => emit('close'), enabled: () => props.open })

const isPlaceholder = computed(() => {
  const src = (props.src ?? '').trim()
  return src === '' || src.startsWith('data:image/svg')
})

const altText = computed(() => {
  const name = (props.name ?? '').trim()
  return name === '' ? 'Фото профиля' : `Фото профиля — ${name}`
})
</script>
<template>
  <Teleport v-if="isMounted" to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain p-3 sm:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="altText"
      >
        <div class="fixed inset-0 bg-ink-900/70 backdrop-blur-sm dark:bg-black/80" @click="emit('close')"></div>
        <Transition name="zoom" appear>
          <figure
            ref="cardRef"
            class="relative m-auto w-[min(94vw,640px)] overflow-hidden rounded-[20px] border border-white/20 bg-stone-100 shadow-float dark:border-zinc-700 dark:bg-zinc-800 sm:w-[min(92vw,640px)] sm:rounded-[24px]"
          >
            <img
              v-if="!isPlaceholder"
              :src="(src as string)"
              :alt="altText"
              class="block h-auto max-h-[calc(100dvh-1.5rem)] w-full object-cover sm:max-h-[calc(100dvh-3rem)]"
            />
            <div
              v-else
              role="img"
              :aria-label="altText"
              class="grid aspect-square max-h-[calc(100dvh-1.5rem)] w-full place-items-center bg-stone-200 text-stone-400 dark:bg-zinc-700 dark:text-zinc-400 sm:max-h-[calc(100dvh-3rem)]"
            >
              <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" class="h-1/3 w-1/3">
                <circle cx="32" cy="22" r="11" />
                <path d="M13 51c3-10 10-15 19-15s16 5 19 15v2H13z" />
              </svg>
            </div>
            <figcaption class="sr-only">{{ altText }}</figcaption>
            <button
              type="button"
              aria-label="Закрыть"
              @click="emit('close')"
              class="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-stone-200 bg-white/95 text-stone-600 shadow-soft transition hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800/95 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:right-4 sm:top-4 sm:h-9 sm:w-9"
            >
              <i class="pi pi-times text-sm"></i>
            </button>
          </figure>
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
