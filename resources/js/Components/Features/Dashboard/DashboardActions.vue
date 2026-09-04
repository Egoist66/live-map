<script setup lang="ts">
import Card from 'primevue/card'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'

defineProps<{ isOwn: boolean }>()
const emit = defineEmits<{ (e: 'map'): void; (e: 'settings'): void; (e: 'faq'): void }>()
</script>
<template>
  <div class="space-y-4 min-w-0 w-full max-w-full">
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight">Действия</h3>
        <div class="mt-4 grid grid-cols-2 min-[380px]:grid-cols-2 gap-2.5 sm:gap-3">
          <Card class="!bg-stone-900 !text-white !rounded-3xl !border-0 hover:!opacity-90 !cursor-pointer dark:!bg-gradient-to-br dark:!from-indigo-500 dark:!to-violet-700 dark:!shadow-[0_12px_36px_-12px_rgba(99,102,241,0.65)]" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }" @click="emit('map')"><template #content><div class="flex flex-col gap-1"><Avatar label="🗺️" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white/15 !text-sm" /><span class="text-sm font-bold">Карта</span><span class="text-[11px] opacity-60">пины рядом</span></div></template></Card>
          <Card v-if="isOwn" class="!bg-stone-50 !border-stone-200 !rounded-3xl hover:!bg-white !cursor-pointer dark:!bg-gradient-to-br dark:!from-zinc-800 dark:!to-zinc-900 dark:!border-zinc-600/70 dark:hover:!bg-zinc-800 dark:!shadow-[0_12px_36px_-12px_rgba(148,163,184,0.35)]" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }" @click="emit('settings')"><template #content><div class="flex flex-col gap-1"><Avatar label="⚙️" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white !border !text-sm dark:!bg-zinc-700 dark:!border-zinc-600 dark:!text-white" /><span class="text-sm font-bold dark:!text-white">Настройки</span><span class="text-[11px] text-stone-500 dark:!text-zinc-400">тариф и прочее</span></div></template></Card>
          <Card class="!bg-gradient-to-br !from-violet-500 !to-teal-500 !text-white !rounded-3xl !border-0 hover:!opacity-90 !cursor-pointer dark:!from-violet-400 dark:!to-teal-300 dark:!shadow-[0_12px_36px_-12px_rgba(139,92,246,0.55)]" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }" @click="emit('map')"><template #content><div class="flex flex-col gap-1"><Avatar label="＋" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white/20 !text-white" /><span class="text-sm font-bold">Новый пин</span><span class="text-[11px] opacity-80">в 2 клика</span></div></template></Card>
          <Card class="!bg-stone-50 !border-stone-200 !rounded-3xl hover:!bg-white !cursor-pointer dark:!bg-gradient-to-br dark:!from-zinc-800 dark:!to-zinc-900 dark:!border-zinc-600/70 dark:hover:!bg-zinc-800 dark:!shadow-[0_12px_36px_-12px_rgba(148,163,184,0.35)]" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }" @click="emit('faq')"><template #content><div class="flex flex-col gap-1"><Avatar label="?" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white !border !text-sm dark:!bg-zinc-700 dark:!border-zinc-600 dark:!text-white" /><span class="text-sm font-bold dark:!text-white">FAQ</span><span class="text-[11px] text-stone-500 dark:!text-zinc-400">как это работает</span></div></template></Card>
        </div>
        <p class="text-xs text-stone-500 mt-4">Ты — не точка, ты — пин. Размытие 200м, анонимные пины и блок в 1 клик.</p>
      </template>
    </Card>
    <Card v-if="isOwn" class="!bg-gradient-to-br !from-amber-50 !to-orange-50 !border-amber-200 !rounded-3xl" :pt="{ body: { class: '!p-4 sm:!p-5' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="text-sm font-black">Нужна помощь?</div>
        <p class="text-xs text-stone-600 mt-1">Напиши в поддержку или задонать проекту — всё в настройках.</p>
        <Button label="Перейти в настройки →" rounded size="small" class="!bg-stone-900 !text-white !border-stone-900 !text-xs !font-bold mt-3" @click="emit('settings')" />
      </template>
    </Card>
  </div>
</template>
