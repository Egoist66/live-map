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

const rays = Array.from({ length: 14 }, (_, i) => i)
</script>

<template>
  <Teleport v-if="isMounted" to="body">
    <div v-if="active" :key="burstKey ?? 0" class="pointer-events-none fixed inset-0 z-[1400] overflow-hidden" aria-hidden="true">
      <div class="boost-flash" />
      <div class="boost-glow" />
      <div class="boost-ring boost-ring-1" />
      <div class="boost-ring boost-ring-2" />
      <div class="boost-ring boost-ring-3" />
      <div class="boost-burst">
        <span
          v-for="i in rays"
          :key="i"
          class="boost-ray"
          :style="{ '--ray-angle': `${i * (360 / 14)}deg` }"
        />
        <span class="boost-core">
          <i class="pi pi-bolt boost-bolt" />
        </span>
      </div>
      <div class="boost-caption">БУСТ · ТЕБЯ ВИДЯТ ПЕРВЫМ</div>
    </div>
  </Teleport>
</template>

<style scoped>
.boost-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 42%, rgba(251, 191, 36, 0.3) 0%, rgba(249, 115, 22, 0.1) 42%, transparent 68%);
  animation: boost-flash 1.25s ease-out forwards;
}
.boost-glow {
  position: absolute;
  left: 50%;
  top: 42%;
  width: min(80vw, 400px);
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.5) 0%, rgba(249, 115, 22, 0.25) 45%, transparent 70%);
  animation: boost-glow 1.25s ease-out forwards;
}
.boost-ring {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 76px;
  height: 76px;
  translate: -50% -50%;
  border-radius: 9999px;
  border: 3px solid rgba(251, 191, 36, 0.85);
  animation: boost-ring 1.25s ease-out forwards;
}
.boost-ring-2 {
  border-color: rgba(249, 115, 22, 0.7);
  animation-delay: 0.1s;
}
.boost-ring-3 {
  border-color: rgba(255, 255, 255, 0.9);
  animation-delay: 0.2s;
}
.boost-burst {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 0;
  height: 0;
}
.boost-ray {
  position: absolute;
  left: -2px;
  top: -2px;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: #fde68a;
  box-shadow: 0 0 12px 2px rgba(251, 191, 36, 0.85);
  transform: rotate(var(--ray-angle)) translateX(36px);
  opacity: 0;
  animation: boost-ray 1.25s ease-out forwards;
}
.boost-core {
  position: absolute;
  left: 0;
  top: 0;
  width: 100px;
  height: 100px;
  translate: -50% -50%;
  display: grid;
  place-items: center;
  border-radius: 9999px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 55%, #fb923c 100%);
  box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.2), 0 0 48px 10px rgba(249, 115, 22, 0.6), 0 12px 32px -8px rgba(249, 115, 22, 0.7);
  animation: boost-pop 1.25s cubic-bezier(0.2, 0.9, 0.25, 1.2) forwards;
}
.boost-bolt {
  font-size: 46px;
  line-height: 1;
  color: #fff;
  filter: drop-shadow(0 2px 8px rgba(120, 53, 15, 0.5));
  animation: boost-bolt-spin 1.25s ease-out forwards;
}
.boost-caption {
  position: absolute;
  left: 50%;
  top: calc(42% + 88px);
  translate: -50% 0;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.2em;
  color: #fef3c7;
  text-shadow: 0 0 18px rgba(249, 115, 22, 0.9), 0 2px 12px rgba(60, 20, 0, 0.6);
  animation: boost-caption 1.25s ease-out forwards;
}
@keyframes boost-flash {
  0% { opacity: 0; }
  12% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes boost-glow {
  0% { transform: scale(0.4); opacity: 0; }
  18% { opacity: 1; }
  100% { transform: scale(1.35); opacity: 0; }
}
@keyframes boost-ring {
  0% { transform: scale(0.5); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: scale(3.4); opacity: 0; }
}
@keyframes boost-pop {
  0% { transform: scale(0.2) rotate(-24deg); opacity: 0; }
  22% { transform: scale(1.15) rotate(8deg); opacity: 1; }
  38% { transform: scale(0.96) rotate(0deg); }
  55% { transform: scale(1.04); }
  75% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.12); opacity: 0; }
}
@keyframes boost-bolt-spin {
  0% { transform: scale(0.4) rotate(-40deg); }
  30% { transform: scale(1.25) rotate(10deg); }
  60% { transform: scale(1) rotate(0deg); }
  100% { transform: scale(1.05) rotate(0deg); }
}
@keyframes boost-ray {
  0% { opacity: 0; transform: rotate(var(--ray-angle)) translateX(32px) scale(0.4); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: rotate(var(--ray-angle)) translateX(130px) scale(1.1); }
}
@keyframes boost-caption {
  0% { opacity: 0; transform: translateY(10px) scale(0.9); }
  20% { opacity: 1; transform: translateY(0) scale(1); }
  75% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-6px) scale(1.02); }
}
@media (prefers-reduced-motion: reduce) {
  .boost-flash,
  .boost-glow,
  .boost-ring,
  .boost-ray,
  .boost-core,
  .boost-bolt,
  .boost-caption {
    animation-duration: 0.45s;
  }
}
</style>
