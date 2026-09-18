<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import { useAvatarPreview } from '@/composables/useAvatarPreview'
import { usePhotoZoom } from '@/composables/usePhotoZoom'
import type { LightboxPhoto } from '@/composables/usePhotoLightbox'

const props = defineProps<{ photos: LightboxPhoto[]; index: number; open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'update:index', value: number): void }>()

useAvatarPreview(() => props.open, () => emit('close'))

const stageRef = ref<HTMLElement | null>(null)
const current = computed(() => props.photos[props.index] ?? null)
const hasMany = computed(() => props.photos.length > 1)

function goNext(): void {
  if (props.index < props.photos.length - 1) {
    emit('update:index', props.index + 1)
  }
}

function goPrev(): void {
  if (props.index > 0) {
    emit('update:index', props.index - 1)
  }
}

const zoom = usePhotoZoom(stageRef, { onSwipeLeft: goNext, onSwipeRight: goPrev })

watch(
  () => props.index,
  () => zoom.reset(),
)
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      zoom.reset()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open && current"
        class="fixed inset-0 z-[3000] flex flex-col bg-black/95"
        role="dialog"
        aria-modal="true"
        aria-label="Просмотр фото"
      >
        <div class="flex shrink-0 items-center gap-1 px-2 pt-[max(0.5rem,var(--sab))] text-white">
          <span v-if="hasMany" class="px-3 text-[13px] font-bold tabular-nums opacity-80">{{ index + 1 }} / {{ photos.length }}</span>
          <span v-else class="flex-1" />
          <span class="flex-1" v-if="hasMany" />
          <Button icon="pi pi-search-minus" text rounded class="!text-white/90 !w-10 !h-10" aria-label="Отдалить" @click="zoom.zoomOut()" />
          <Button icon="pi pi-search-plus" text rounded class="!text-white/90 !w-10 !h-10" aria-label="Приблизить" @click="zoom.zoomIn()" />
          <Button icon="pi pi-times" text rounded class="!text-white/90 !w-10 !h-10" aria-label="Закрыть" @click="emit('close')" />
        </div>
        <div ref="stageRef" class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden touch-none select-none">
          <img
            :key="current.src"
            :src="current.src"
            :alt="current.alt || 'Фото'"
            :style="zoom.imgStyle.value"
            draggable="false"
            class="max-h-full max-w-full object-contain will-change-transform"
            @dblclick="zoom.toggle()"
          />
          <Button
            v-if="hasMany && index > 0"
            icon="pi pi-chevron-left"
            rounded
            text
            class="!absolute left-1.5 top-1/2 -translate-y-1/2 !bg-black/40 !text-white !border-0 !w-10 !h-10"
            aria-label="Назад"
            @click="goPrev()"
          />
          <Button
            v-if="hasMany && index < photos.length - 1"
            icon="pi pi-chevron-right"
            rounded
            text
            class="!absolute right-1.5 top-1/2 -translate-y-1/2 !bg-black/40 !text-white !border-0 !w-10 !h-10"
            aria-label="Вперёд"
            @click="goNext()"
          />
        </div>
        <p v-if="current.alt" class="shrink-0 truncate px-4 pb-[max(0.75rem,var(--sab))] pt-2 text-center text-[13px] text-white/70">{{ current.alt }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
