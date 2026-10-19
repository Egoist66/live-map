<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCachedImageSrc } from '@/composables/useImageBlobCache'

/**
 * Картинка с красивой загрузкой: шиммер-скелетон (светлая/тёмная тема),
 * плавное проявление blur-up и заглушка при ошибке.
 *
 * Источник резолвится через бинарный IDB-кеш (`useCachedImageSrc`): хит
 * отдаётся objectURL'ом за миллисекунды без единого HTTP — картинки не
 * ждут сеть после перезагрузки/офлайн. Промах не блокирует: параллельно
 * возвращается исходный URL и blob тихо докачивается в фон.
 *
 * Корень pointer-events-none — безопасен внутри drag-колод и кнопок.
 * Класс родителя (позиция/размер) падает на корень автоматически.
 */
const props = withDefaults(
  defineProps<{
    /** URL картинки (null — пустой корень). */
    src?: string | null
    /** Alt-текст. */
    alt?: string
    /** Классы для внутреннего img (object-cover и т.п.). */
    imgClass?: string | string[] | Record<string, boolean>
    /** Инлайн-стиль для img (например, drag-трансформ). */
    imgStyle?: Record<string, string>
    /** Грузить сразу, а не лениво. */
    eager?: boolean
    /** Отключить IDB-кеш (внешние CDN, data: и т.п.). */
    cached?: boolean
  }>(),
  { src: null, alt: '', imgClass: '', imgStyle: undefined, eager: false, cached: true },
)

const { src: cachedSrc } = useCachedImageSrc(() => props.src ?? '', props.src ?? '')
const displaySrc = computed(() => (props.cached ? cachedSrc.value : (props.src ?? '')))

const loaded = ref(false)
const failed = ref(false)

watch(
  displaySrc,
  () => {
    loaded.value = false
    failed.value = false
  },
  { immediate: true },
)
</script>

<template>
  <span class="app-image pointer-events-none block" :class="{ 'is-loaded': loaded }">
    <span v-if="displaySrc && !loaded && !failed" class="app-image-shimmer" aria-hidden="true" />
    <img
      v-if="displaySrc && !failed"
      :key="displaySrc"
      :src="displaySrc"
      :alt="alt"
      :class="imgClass"
      :style="imgStyle"
      :loading="eager ? 'eager' : 'lazy'"
      draggable="false"
      @load="loaded = true"
      @error="failed = true"
    />
    <span v-if="displaySrc && failed" class="app-image-fallback" role="img" :aria-label="alt || 'Картинка не загрузилась'">
      <i class="pi pi-image" />
    </span>
  </span>
</template>

<style scoped>
.app-image img {
  opacity: 0;
  filter: blur(8px);
  transition: opacity 0.45s ease, filter 0.45s ease, transform 0.3s ease;
  /* Свой композитный слой: в старых WebView перерисовка картинки
     при скролле даёт моргание. */
  transform: translateZ(0);
}
.app-image.is-loaded img {
  opacity: 1;
  filter: blur(0);
}
.app-image-shimmer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #e7e5e4;
}
.app-image-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.65) 50%, transparent 80%);
  animation: app-image-sweep 1.4s ease-in-out infinite;
}
html.dark .app-image-shimmer {
  background: #27272a;
}
html.dark .app-image-shimmer::after {
  background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.09) 50%, transparent 80%);
}
.app-image-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: #e7e5e4;
  color: #a8a29e;
  font-size: 1.5rem;
}
html.dark .app-image-fallback {
  background: #27272a;
  color: #52525b;
}
@keyframes app-image-sweep {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .app-image-shimmer::after { animation: none; }
  .app-image img { filter: none; }
}
</style>
