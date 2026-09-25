<script setup lang="ts">
import { useAuthBackdrop } from '@/composables/useAuthBackdrop'

const backdrop = useAuthBackdrop()
const tokens = backdrop.tokens
</script>

<template>
  <div aria-hidden="true" class="auth-backdrop-enter pointer-events-none absolute inset-0 overflow-hidden">
    <div class="absolute inset-0" :class="[tokens.skyClass, tokens.skyDarkClass]" />

    <div class="auth-blob-a absolute -top-32 right-[-8rem] h-[34rem] w-[34rem] rounded-full blur-[110px]" :class="tokens.blobAClass" />
    <div class="auth-blob-b absolute bottom-[-10rem] left-[-9rem] h-[30rem] w-[30rem] rounded-full blur-[110px]" :class="tokens.blobBClass" />

    <template v-if="tokens.pattern === 'hearts'">
      <i class="auth-float pi pi-heart-fill absolute left-[12%] top-[24%] hidden text-2xl text-rose-400/40 dark:text-rose-400/20 sm:block [animation-duration:9s]" />
      <i class="auth-float pi pi-heart-fill absolute right-[13%] top-[20%] text-xl text-fuchsia-400/40 dark:text-fuchsia-400/20 [animation-duration:11s] [animation-delay:1.5s]" />
      <i class="auth-float pi pi-heart-fill absolute bottom-[26%] left-[16%] hidden text-lg text-orange-300/50 dark:text-orange-300/20 md:block [animation-duration:10s] [animation-delay:3s]" />
      <i class="auth-float pi pi-heart-fill absolute bottom-[30%] right-[17%] hidden text-3xl text-rose-300/30 dark:text-rose-300/15 lg:block [animation-duration:12s] [animation-delay:0.8s]" />
      <i class="auth-float pi pi-heart-fill absolute left-[46%] top-[12%] hidden text-lg text-pink-300/40 dark:text-pink-300/15 md:block [animation-duration:10s] [animation-delay:2.2s]" />
      <i class="auth-float pi pi-heart-fill absolute bottom-[12%] left-[42%] hidden text-xl text-fuchsia-300/30 dark:text-fuchsia-300/15 lg:block [animation-duration:13s] [animation-delay:4s]" />
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
.auth-ring {
  animation: auth-ring 3.2s ease-out infinite;
}
.auth-bar {
  animation: auth-bar-grow 5s ease-in-out infinite alternate;
  transform-origin: bottom;
}
.auth-float {
  animation: auth-float-up 10s ease-in-out infinite;
  will-change: transform, opacity;
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
@keyframes auth-ring {
  0% {
    transform: scale(1);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.65);
    opacity: 0;
  }
}
@keyframes auth-bar-grow {
  from {
    transform: scaleY(0.86);
  }
  to {
    transform: scaleY(1);
  }
}
@keyframes auth-float-up {
  0% {
    transform: translateY(26px);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translateY(-110px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .auth-backdrop-enter,
  .auth-blob-a,
  .auth-blob-b,
  .auth-ring,
  .auth-bar,
  .auth-float {
    animation: none;
  }
}
</style>
