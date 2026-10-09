<script setup lang="ts">
import { useMounted } from '@vueuse/core'

defineProps<{
  /** Показать сплеш */
  active: boolean
  /** Ключ залпа: смена перезапускает CSS-анимации */
  burstKey?: number
}>()

// Сырой Teleport к body — только после mount, иначе SSR-гидратация
// падает с `insertBefore of null` (см. MatchSplash).
const isMounted = useMounted()

const rays = Array.from({ length: 12 }, (_, i) => i)
</script>

<template>
  <Teleport v-if="isMounted" to="body">
    <div v-if="active" :key="burstKey ?? 0" class="pointer-events-none fixed inset-0 z-[1400] overflow-hidden" aria-hidden="true">
      <div class="superlike-flash" />
      <div class="superlike-glow" />
      <div class="superlike-ring superlike-ring-1" />
      <div class="superlike-ring superlike-ring-2" />
      <div class="superlike-ring superlike-ring-3" />
      <div class="superlike-burst">
        <span
          v-for="i in rays"
          :key="i"
          class="superlike-ray"
          :style="{ '--ray-angle': `${i * 30}deg` }"
        />
        <span class="superlike-core">
          <i class="pi pi-star-fill superlike-star" />
        </span>
      </div>
      <div class="superlike-caption">СУПЕРЛАЙК</div>
    </div>
  </Teleport>
</template>

<style scoped>
.superlike-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 42%, rgba(23, 134, 255, 0.28) 0%, rgba(23, 134, 255, 0.08) 42%, transparent 68%);
  animation: superlike-flash 1.15s ease-out forwards;
}
.superlike-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: min(78vw, 380px);
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(23, 134, 255, 0.45) 0%, rgba(0, 198, 255, 0.22) 45%, transparent 70%);
  animation: superlike-glow 1.15s ease-out forwards;
}
.superlike-ring {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 72px;
  height: 72px;
  translate: -50% -50%;
  border-radius: 9999px;
  border: 3px solid rgba(23, 134, 255, 0.8);
  animation: superlike-ring 1.15s ease-out forwards;
}
.superlike-ring-2 {
  border-color: rgba(0, 198, 255, 0.7);
  animation-delay: 0.1s;
}
.superlike-ring-3 {
  border-color: rgba(255, 255, 255, 0.85);
  animation-delay: 0.2s;
}
.superlike-burst {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 0;
  height: 0;
}
.superlike-ray {
  position: absolute;
  left: -2px;
  top: -2px;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: #7cc4ff;
  box-shadow: 0 0 12px 2px rgba(23, 134, 255, 0.8);
  transform: rotate(var(--ray-angle)) translateX(34px);
  opacity: 0;
  animation: superlike-ray 1.15s ease-out forwards;
}
.superlike-core {
  position: absolute;
  left: 0;
  top: 0;
  width: 96px;
  height: 96px;
  translate: -50% -50%;
  display: grid;
  place-items: center;
  border-radius: 9999px;
  background: linear-gradient(135deg, #1786ff 0%, #00c6ff 60%, #7cc4ff 100%);
  box-shadow: 0 0 0 6px rgba(23, 134, 255, 0.18), 0 0 44px 8px rgba(23, 134, 255, 0.55), 0 12px 32px -8px rgba(23, 134, 255, 0.7);
  animation: superlike-pop 1.15s cubic-bezier(0.2, 0.9, 0.25, 1.2) forwards;
}
.superlike-star {
  font-size: 44px;
  line-height: 1;
  color: #fff;
  filter: drop-shadow(0 2px 8px rgba(0, 40, 90, 0.45));
  animation: superlike-star-spin 1.15s ease-out forwards;
}
.superlike-caption {
  position: absolute;
  left: 50%;
  top: calc(42% + 84px);
  translate: -50% 0;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.22em;
  color: #bfe1ff;
  text-shadow: 0 0 18px rgba(23, 134, 255, 0.9), 0 2px 12px rgba(0, 20, 50, 0.6);
  animation: superlike-caption 1.15s ease-out forwards;
}
@keyframes superlike-flash {
  0% { opacity: 0; }
  12% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes superlike-glow {
  0% { transform: scale(0.4); opacity: 0; }
  18% { opacity: 1; }
  100% { transform: scale(1.35); opacity: 0; }
}
@keyframes superlike-ring {
  0% { transform: scale(0.5); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: scale(3.4); opacity: 0; }
}
@keyframes superlike-pop {
  0% { transform: scale(0.2) rotate(-24deg); opacity: 0; }
  22% { transform: scale(1.15) rotate(8deg); opacity: 1; }
  38% { transform: scale(0.96) rotate(0deg); }
  55% { transform: scale(1.04); }
  75% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.12); opacity: 0; }
}
@keyframes superlike-star-spin {
  0% { transform: scale(0.4) rotate(-40deg); }
  30% { transform: scale(1.2) rotate(10deg); }
  60% { transform: scale(1) rotate(0deg); }
  100% { transform: scale(1.05) rotate(0deg); }
}
@keyframes superlike-ray {
  0% { opacity: 0; transform: rotate(var(--ray-angle)) translateX(30px) scale(0.4); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--ray-angle)) translateX(120px) scale(1.1); }
}
@keyframes superlike-caption {
  0% { opacity: 0; transform: translateY(10px) scale(0.9); }
  20% { opacity: 1; transform: translateY(0) scale(1); }
  75% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-6px) scale(1.02); }
}
@media (prefers-reduced-motion: reduce) {
  .superlike-flash,
  .superlike-glow,
  .superlike-ring,
  .superlike-ray,
  .superlike-core,
  .superlike-star,
  .superlike-caption {
    animation-duration: 0.45s;
  }
}
</style>
