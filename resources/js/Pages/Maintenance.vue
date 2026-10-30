<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{ title?: string; message?: string }>(), {
  title: 'Технические работы',
  message: 'Мы скоро вернёмся.',
})

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    try { router.reload({ only: [] }) } catch {}
  }, 30000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>
<template>
  <Head title="Технические работы" />
  <div class="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-stone-950 via-[#0F121F] to-rose-950 px-4 py-10 overflow-hidden relative">
    <div class="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />
    <div class="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl" />
    <div class="relative w-full max-w-md text-center">
      <div class="mx-auto w-20 h-20 rounded-[28px] bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 grid place-items-center shadow-glow animate-bounce" style="animation-duration: 2.5s">
        <i class="pi pi-wrench text-white text-3xl" />
      </div>
      <h1 class="mt-6 text-2xl sm:text-3xl font-black tracking-tight text-white">{{ title }}</h1>
      <p class="mt-3 text-sm sm:text-[15px] leading-relaxed text-white/60">{{ message }}</p>
      <div class="mt-6 flex items-center justify-center gap-2 text-white/40 text-xs font-semibold">
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Проверяем каждые 30 секунд — страница обновится сама
      </div>
    </div>
  </div>
</template>
