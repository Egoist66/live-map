<script setup lang="ts">
import { useAuthBackdrop } from '@/composables/useAuthBackdrop'

/**
 * Анимированный фон страниц входа и регистрации.
 *
 * Механика в `useAuthBackdrop` (Правило №1): раскладка сердечек,
 * тона и градиенты приходят оттуда, а компонент только рисует.
 * Слой всегда за контентом и не перехватывает тачи
 * (`pointer-events-none`).
 */
const backdrop = useAuthBackdrop()
const tokens = backdrop.tokens
</script>

<template>
  <div aria-hidden="true" class="auth-backdrop-enter pointer-events-none absolute inset-0 overflow-hidden">
    <div class="absolute inset-0" :class="[tokens.skyClass, tokens.skyDarkClass]" />

    <div class="auth-blob-a absolute -top-32 right-[-8rem] h-[34rem] w-[34rem] rounded-full blur-[110px]" :class="tokens.blobAClass" />
    <div class="auth-blob-b absolute bottom-[-10rem] left-[-9rem] h-[30rem] w-[30rem] rounded-full blur-[110px]" :class="tokens.blobBClass" />

    <template v-if="tokens.pattern === 'hearts'">
      <i class="auth-heartbeat pi pi-heart-fill absolute left-1/2 top-1/2 select-none text-rose-500/[0.06] dark:text-rose-400/[0.09]" />

      <i
        v-for="heart in backdrop.hearts"
        :key="heart.id"
        class="auth-heart pi pi-heart-fill"
        :class="heart.toneClass"
        :style="heart.style"
      />
    </template>

    <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/[0.05] dark:to-black/40" />
  </div>
</template>

<style scoped>
.auth-backdrop-enter {
  animation: auth-backdrop-in 0.9s ease-out both;
}
@keyframes auth-backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.auth-blob-a {
  animation: auth-drift-a 24s ease-in-out infinite alternate;
  will-change: transform;
}
.auth-blob-b {
  animation: auth-drift-b 28s ease-in-out infinite alternate;
  will-change: transform;
}
/* Медленно всплывающие сердечки: стартуют из-за нижней кромки,
   качаются в стороны и растворяются у верха. Позиция, размер и
   тайминги приходят из композабла через CSS-переменные. */
.auth-heart {
  position: absolute;
  bottom: -5rem;
  line-height: 1;
  animation-name: auth-heart-rise;
  animation-timing-function: cubic-bezier(0.37, 0, 0.63, 1);
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
/* Большое полупрозрачное сердце за карточкой: мягко «бьётся»,
   давая Tinder-настроение, но не мешает чтению формы. */
.auth-heartbeat {
  font-size: clamp(190px, 44vmin, 480px);
  transform: translate(-50%, -50%);
  animation: auth-heartbeat 3.6s ease-in-out infinite;
  will-change: transform;
}
@keyframes auth-drift-a {
  from {
    transform: translate(0, 0) scale(1);
  }
  to {
    transform: translate(-70px, 50px) scale(1.15);
  }
}
@keyframes auth-drift-b {
  from {
    transform: translate(0, 0) scale(1.12);
  }
  to {
    transform: translate(60px, -40px) scale(1);
  }
}
@keyframes auth-heart-rise {
  0% {
    transform: translate3d(0, 0, 0) rotate(-12deg) scale(0.55);
    opacity: 0;
  }
  10% {
    opacity: var(--auth-heart-opacity, 0.5);
  }
  55% {
    transform: translate3d(var(--auth-heart-sway, 18px), -48vh, 0) rotate(10deg) scale(1);
    opacity: var(--auth-heart-opacity, 0.5);
  }
  100% {
    transform: translate3d(calc(var(--auth-heart-sway, 18px) * -0.7), -94vh, 0) rotate(-8deg) scale(0.85);
    opacity: 0;
  }
}
@keyframes auth-heartbeat {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
  }
  14% {
    transform: translate(-50%, -50%) scale(1.08);
  }
  28% {
    transform: translate(-50%, -50%) scale(1);
  }
  42% {
    transform: translate(-50%, -50%) scale(1.06);
  }
  56% {
    transform: translate(-50%, -50%) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .auth-backdrop-enter,
  .auth-blob-a,
  .auth-blob-b,
  .auth-heart,
  .auth-heartbeat {
    animation: none;
  }
}
</style>
