<script setup lang="ts">
import { ref } from 'vue'
import { useBusinessSettings } from '@/composables/useBusinessSettings'

withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' })

const settings = useBusinessSettings()
const fileInput = ref<HTMLInputElement | null>(null)

function openPicker(): void {
  fileInput.value?.click()
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (input) {
    input.value = ''
  }
  if (!file) {
    return
  }
  await settings.uploadLogoFile(file)
}
</script>

<template>
  <div class="relative shrink-0">
    <span
      :class="[
        'grid place-items-center overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-soft',
        size === 'lg' ? 'w-14 h-14 rounded-2xl text-2xl' : 'w-11 h-11 rounded-2xl text-xl',
      ]"
    >
      <img v-if="settings.profile.value?.logo_url" :src="settings.profile.value.logo_url" alt="Логотип компании" class="w-full h-full object-cover" />
      <span v-else>🏢</span>
    </span>
    <button
      type="button"
      aria-label="Загрузить логотип"
      :disabled="settings.store.saving"
      class="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow grid place-items-center text-indigo-600 dark:text-indigo-400 hover:scale-105 transition active:scale-95 disabled:opacity-60"
      @click="openPicker"
    >
      <i class="pi pi-camera text-[11px]" />
    </button>
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
  </div>
</template>
