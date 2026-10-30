<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useMounted } from '@vueuse/core'
import { useMatchHearts } from '@/composables/useMatchHearts'

const props = defineProps<{ active: boolean }>()

// Сырой Teleport к body — только после mount, иначе SSR-гидратация
// падает с `insertBefore of null` (см. PhotoLightbox/AvatarPreview).
const isMounted = useMounted()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hearts = useMatchHearts(canvasRef)

watch(
  () => props.active,
  async (isActive) => {
    if (isActive) {
      await nextTick()
      hearts.play()
      return
    }
    hearts.stop()
  },
  { immediate: true },
)
</script>

<template>
  <Teleport v-if="isMounted" to="body">
    <div v-if="active" class="pointer-events-none fixed inset-0 z-[1400] overflow-hidden" aria-hidden="true">
      <div class="match-splash-glow" />
      <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" />
    </div>
  </Teleport>
</template>

<style scoped>
.match-splash-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: min(92vw, 520px);
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 9999px;
  background: radial-gradient(
    circle,
    rgba(244, 63, 94, 0.35) 0%,
    rgba(236, 72, 153, 0.22) 38%,
    rgba(217, 70, 239, 0.1) 62%,
    transparent 72%
  );
  animation: match-glow 2.4s ease-out infinite;
}
@keyframes match-glow {
  0% { transform: scale(0.7); opacity: 0; }
  25% { opacity: 1; }
  100% { transform: scale(1.25); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .match-splash-glow { animation: none; opacity: 0.6; transform: scale(1); }
}
</style>
