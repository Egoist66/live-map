<script setup lang="ts">
import Card from 'primevue/card'

defineProps<{ theme: any }>()
const emit = defineEmits<{ (e: 'theme', v: any): void }>()
const options = [{ v: 'light', label: 'Светлая', icon: '☀️' }, { v: 'dark', label: 'Тёмная', icon: '🌙' }, { v: 'system', label: 'Система', icon: '◐' }]
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Внешний вид</h3>
      <p class="text-sm text-stone-500 mt-1">Тема оформления и отображение карты.</p>
      <div class="mt-6 space-y-5 max-w-xl">
        <div>
          <div class="text-sm font-semibold dark:text-white">Тема</div>
          <div class="text-xs text-stone-500">Выбери как выглядит UPin на этом устройстве</div>
          <div class="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
            <Card v-for="o in options" :key="o.v" @click="emit('theme', o.v)" :class="['!rounded-3xl !cursor-pointer !transition', theme === o.v ? '!bg-stone-900 !text-white !border-stone-900' : '!bg-white dark:!bg-zinc-800 !border-stone-200 hover:!bg-stone-50']" :pt="{ body: { class: '!p-3 !flex !flex-col !items-center !gap-2' }, content: { class: '!p-0' } }"><template #content><span class="w-10 h-10 rounded-xl bg-stone-100 grid place-items-center text-sm">{{ o.icon }}</span><span class="text-xs font-semibold">{{ o.label }}</span></template></Card>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
