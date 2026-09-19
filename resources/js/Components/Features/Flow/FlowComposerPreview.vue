<script setup lang="ts">
import Button from 'primevue/button'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Keyboard } from 'swiper/modules'
import 'swiper/css'
import { useFlowMediaSwiper } from '@/composables/useFlowMediaSwiper'

const props = defineProps<{ previews: string[] }>()

const emit = defineEmits<{
  (e: 'remove', index: number): void
}>()

const carousel = useFlowMediaSwiper(() => props.previews.length)
const modules = [Keyboard]
</script>

<template>
  <div v-if="previews.length" class="relative mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-700">
    <Swiper
      :slides-per-view="1"
      :space-between="0"
      :speed="300"
      :keyboard="{ enabled: true }"
      :observer="true"
      :observe-parents="true"
      :update-on-window-resize="true"
      :modules="modules"
      @swiper="carousel.register"
      @slideChange="carousel.onSlideChange"
    >
      <SwiperSlide v-for="(src, i) in previews" :key="src">
        <div class="relative">
          <img :src="src" alt="Превью" draggable="false" class="h-56 w-full select-none object-cover sm:h-72" />
          <Button
            icon="pi pi-times"
            rounded
            severity="danger"
            aria-label="Убрать фото"
            class="!absolute !right-1.5 !top-1.5 !h-7 !w-7"
            @click="emit('remove', i)"
          />
        </div>
      </SwiperSlide>
    </Swiper>
    <div v-if="previews.length > 1" class="absolute bottom-2 left-1/2 z-10 inline-flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-nowrap items-center gap-1.5 overflow-hidden rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-black/10 backdrop-blur-sm dark:bg-black/55 dark:ring-white/15">
      <button
        v-for="(src, i) in previews"
        :key="src"
        type="button"
        :aria-label="`Слайд ${i + 1}`"
        :aria-current="i === carousel.index.value ? 'true' : undefined"
        :class="['h-[6px] w-[6px] shrink-0 rounded-full !min-h-0 !min-w-0 !border-0 !p-0 transition-colors duration-200', i === carousel.index.value ? 'scale-110 bg-stone-900 dark:bg-white' : 'bg-stone-900/30 hover:bg-stone-900/60 dark:bg-white/40 dark:hover:bg-white/75']"
        @click="carousel.go(i)"
      />
    </div>
    <span v-if="previews.length > 1" class="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
      {{ carousel.index.value + 1 }}/{{ previews.length }}
    </span>
  </div>
</template>
