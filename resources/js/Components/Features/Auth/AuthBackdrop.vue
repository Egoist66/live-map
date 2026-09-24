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

    <template v-if="tokens.pattern === 'pins'">
      <div
        class="absolute inset-0 opacity-50 dark:opacity-[0.16]"
        style="background-image: radial-gradient(circle at 1px 1px, rgb(56 130 246 / 0.35) 1px, transparent 0); background-size: 26px 26px"
      />
      <svg class="absolute inset-0 hidden h-full w-full sm:block" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d="M8,82 C26,70 30,92 48,58 S72,44 92,22"
          fill="none"
          stroke="rgb(56 130 246 / 0.45)"
          stroke-width="0.6"
          stroke-dasharray="2.5 2"
          stroke-linecap="round"
        />
      </svg>
      <div class="absolute left-[10%] top-[20%] hidden h-11 w-11 place-items-center rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-sky-500/20 backdrop-blur md:grid">
        <span class="auth-ring absolute inset-0 rounded-2xl border-2 border-sky-400/60" />
        <i class="pi pi-map-marker text-lg text-sky-600 dark:text-sky-300" />
      </div>
      <div class="absolute right-[11%] top-[28%] grid h-11 w-11 place-items-center rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-indigo-500/20 backdrop-blur">
        <span class="auth-ring absolute inset-0 rounded-2xl border-2 border-indigo-400/60 [animation-delay:1.4s]" />
        <i class="pi pi-map-marker text-lg text-indigo-600 dark:text-indigo-300" />
      </div>
      <div class="absolute bottom-[16%] left-[18%] hidden h-11 w-11 place-items-center rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-teal-500/20 backdrop-blur lg:grid">
        <span class="auth-ring absolute inset-0 rounded-2xl border-2 border-teal-400/60 [animation-delay:2.6s]" />
        <i class="pi pi-map-marker text-lg text-teal-600 dark:text-teal-300" />
      </div>
      <div class="absolute bottom-[24%] right-[20%] hidden h-11 w-11 place-items-center rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-sky-500/20 backdrop-blur lg:grid">
        <span class="auth-ring absolute inset-0 rounded-2xl border-2 border-sky-400/60 [animation-delay:0.7s]" />
        <i class="pi pi-flag text-lg text-sky-600 dark:text-sky-300" />
      </div>
    </template>

    <template v-else-if="tokens.pattern === 'skyline'">
      <div
        class="absolute inset-0 opacity-40 dark:opacity-[0.14]"
        style="background-image: linear-gradient(rgb(180 130 40 / 0.25) 1px, transparent 1px), linear-gradient(90deg, rgb(180 130 40 / 0.25) 1px, transparent 1px); background-size: 30px 30px"
      />
      <svg class="absolute right-[4%] top-[16%] hidden w-72 opacity-70 sm:block" viewBox="0 0 100 60">
        <polyline
          points="2,52 18,46 32,48 50,32 66,36 84,16 98,20"
          fill="none"
          stroke="rgb(245 180 60 / 0.8)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="98" cy="20" r="3" fill="rgb(245 180 60 / 0.9)" />
      </svg>
      <div class="absolute inset-x-0 bottom-0 flex h-44 items-end justify-center gap-1.5 opacity-70 sm:gap-2.5">
        <div class="auth-bar w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 sm:w-9" style="height: 32%" />
        <div class="auth-bar w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 sm:w-9" style="height: 56%; animation-delay: 0.4s" />
        <div class="auth-bar w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 sm:w-9" style="height: 42%; animation-delay: 0.8s" />
        <div class="auth-bar w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 sm:w-9" style="height: 72%; animation-delay: 1.2s" />
        <div class="auth-bar w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 sm:w-9" style="height: 54%; animation-delay: 1.6s" />
        <div class="auth-bar hidden w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 sm:block sm:w-9" style="height: 88%; animation-delay: 2s" />
        <div class="auth-bar hidden w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 sm:block sm:w-9" style="height: 64%; animation-delay: 2.4s" />
        <div class="auth-bar hidden w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 md:block md:w-9" style="height: 96%; animation-delay: 2.8s" />
        <div class="auth-bar hidden w-6 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 md:block md:w-9" style="height: 58%; animation-delay: 3.2s" />
        <div class="auth-bar hidden w-9 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 lg:block" style="height: 78%; animation-delay: 3.6s" />
        <div class="auth-bar hidden w-9 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 lg:block" style="height: 46%; animation-delay: 4s" />
        <div class="auth-bar hidden w-9 rounded-t-lg bg-gradient-to-t from-amber-500/30 to-amber-200/5 dark:from-amber-400/25 lg:block" style="height: 66%; animation-delay: 4.4s" />
      </div>
      <div class="absolute left-[8%] top-[22%] hidden items-center gap-2.5 rounded-2xl border border-amber-200/50 bg-white/60 px-3.5 py-2.5 shadow-lg shadow-amber-500/10 backdrop-blur dark:border-amber-200/10 dark:bg-white/5 md:flex">
        <i class="pi pi-briefcase text-amber-600 dark:text-amber-300" />
        <span class="text-xs font-bold text-stone-600 dark:text-zinc-300">UPin Pro</span>
      </div>
    </template>

    <template v-else>
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
