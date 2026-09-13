<script setup lang="ts">
import SelectButton from 'primevue/selectbutton'
import Message from 'primevue/message'
import { computed, ref, watch } from 'vue'
import { useDefaultMode } from '@/composables/useDefaultMode'

const mode = useDefaultMode()

const picked = ref<'ulove' | 'upin'>(mode.mode.value)
watch(() => mode.mode.value, (next) => {
  picked.value = next
})

const options = [
  { label: '💘 ULove', value: 'ulove' },
  { label: '📍 UPin', value: 'upin' },
]

const hint = computed(() => {
  return picked.value === 'upin'
    ? 'Приложение будет открываться с карты. ULove останется доступен из меню.'
    : 'Приложение будет открываться со свайпов. Карта останется доступна из меню.'
})

async function onChange(): Promise<void> {
  if (picked.value === mode.mode.value) {
    return
  }
  try {
    await mode.choose(picked.value)
  } catch {
    picked.value = mode.mode.value
  }
}
</script>

<template>
  <div class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
    <div class="flex items-center gap-3">
      <i class="pi pi-home text-lg text-rose-500 shrink-0" />
      <div class="flex-1 text-sm">
        <p class="font-semibold dark:text-white">Стартовый экран</p>
        <p class="text-xs opacity-60">Что открывать после входа: свайпы или карту</p>
      </div>
    </div>
    <SelectButton v-model="picked" :options="options" option-label="label" option-value="value" class="mt-3 flex w-full [&>*]:flex-1" :disabled="mode.saving.value" @change="onChange" />
    <p class="text-xs text-stone-500 dark:text-zinc-400 mt-2 leading-relaxed">{{ hint }}</p>
    <Message v-if="mode.error.value" severity="error" :closable="false" class="mt-2">{{ mode.error.value }}</Message>
  </div>
</template>
