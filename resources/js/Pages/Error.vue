<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import Button from 'primevue/button'
import { useErrorPage } from '@/composables/useErrorPage'

const props = withDefaults(defineProps<{ status?: number | string }>(), { status: 404 })

const page = useErrorPage(props.status)
</script>

<template>
  <Head :title="page.content.value.title" />
  <div class="min-h-[100dvh] grid place-items-center bg-surface dark:bg-[#0F121F] px-4 py-10 overflow-hidden relative">
    <div aria-hidden="true" class="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-violet-600/15 dark:bg-violet-600/20 blur-3xl" />
    <div aria-hidden="true" class="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-indigo-600/15 dark:bg-indigo-600/20 blur-3xl" />
    <div class="relative w-full max-w-md text-center">
      <div class="mx-auto w-20 h-20 rounded-[28px] bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 grid place-items-center shadow-glow text-4xl">
        {{ page.content.value.emoji }}
      </div>
      <h1 class="mt-6 text-xl sm:text-2xl font-black tracking-tight dark:text-white">{{ page.content.value.title }}</h1>
      <p class="mt-3 text-sm sm:text-[15px] leading-relaxed text-stone-500 dark:text-zinc-400">{{ page.content.value.hint }}</p>
      <div class="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
        <Button label="В профиль" icon="pi pi-user" rounded class="!px-7 !border-0 !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !text-white" @click="page.goProfile()" />
        <Button label="Назад" icon="pi pi-arrow-left" rounded outlined severity="secondary" class="!px-7" @click="page.goBack()" />
      </div>
    </div>
  </div>
</template>
