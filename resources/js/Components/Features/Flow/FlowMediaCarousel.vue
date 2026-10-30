<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Keyboard } from 'swiper/modules'
import 'swiper/css'
import { useFlowMediaSwiper } from '@/composables/useFlowMediaSwiper'
import type { FlowMedia } from '@/types/flow'

const props = defineProps<{ media: FlowMedia[] }>()

const emit = defineEmits<{
  (e: 'preview', url: string, index: number): void
}>()

const carousel = useFlowMediaSwiper(() => props.media.length)
const modules = [Keyboard]
</script>

<template>
  <div v-if="media.length" class="relative mt-3 overflow-hidden rounded-2xl border border-stone-200 dark:border-white/10">
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
      <SwiperSlide v-for="(m, i) in media" :key="m.id">
        <button
          v-if="m.kind === 'photo' && m.url"
          type="button"
          class="block w-full cursor-zoom-in"
          aria-label="Открыть фото на весь экран"
          @click="emit('preview', m.url, i)"
        >
          <img :src="m.url" alt="Фото поста" loading="lazy" draggable="false" class="aspect-[4/3] w-full select-none object-cover sm:aspect-auto sm:max-h-[420px]" />
        </button>
        <video
          v-else-if="m.kind === 'video' && m.url"
          :src="m.url"
          controls
          preload="metadata"
          playsinline
          class="aspect-[4/3] w-full bg-black object-contain sm:aspect-auto sm:max-h-[420px]"
        />
      </SwiperSlide>
    </Swiper>
    <div v-if="media.length > 1" class="absolute bottom-2 left-1/2 z-10 inline-flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-nowrap items-center gap-1.5 overflow-hidden rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-black/10 backdrop-blur-sm dark:bg-black/55 dark:ring-white/15">
      <button
        v-for="(m, i) in media"
        :key="m.id"
        type="button"
        :aria-label="`Слайд ${i + 1}`"
        :aria-current="i === carousel.index.value ? 'true' : undefined"
        :class="['h-[6px] w-[6px] shrink-0 rounded-full !min-h-0 !min-w-0 !border-0 !p-0 transition-colors duration-200', i === carousel.index.value ? 'scale-110 bg-stone-900 dark:bg-white' : 'bg-stone-900/30 hover:bg-stone-900/60 dark:bg-white/40 dark:hover:bg-white/75']"
        @click="carousel.go(i)"
      />
    </div>
    <span v-if="media.length > 1" class="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
      {{ carousel.index.value + 1 }}/{{ media.length }}
    </span>
  </div>
</template>
