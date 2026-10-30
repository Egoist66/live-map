<script setup lang="ts">
import { ref } from 'vue'
import { useBusinessSettings } from '@/composables/useBusinessSettings'
import BusinessCoverCropDialog from '@/Components/Features/Business/BusinessCoverCropDialog.vue'

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
  await settings.pickCoverFile(file)
}
</script>

<template>
  <div>
    <div class="relative rounded-2xl overflow-hidden bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 min-h-[110px] grid place-items-center">
      <img v-if="settings.profile.value?.cover_url" :src="settings.profile.value.cover_url" alt="Обложка компании" class="absolute inset-0 w-full h-full object-cover" />
      <div v-else class="absolute inset-0 opacity-30" style="background-image: radial-gradient(circle at 80% 20%, rgba(255,255,255,.5) 0 2px, transparent 3px); background-size: 48px 48px;"></div>
      <button
        type="button"
        :disabled="settings.store.saving"
        class="relative m-2 px-4 py-2.5 rounded-full bg-black/55 hover:bg-black/70 text-white text-[13px] font-bold backdrop-blur transition active:scale-95 disabled:opacity-60 flex items-center gap-2"
        @click="openPicker"
      >
        <i class="pi pi-image text-sm" />
        {{ settings.store.saving ? 'Загрузка…' : settings.profile.value?.cover_url ? 'Сменить обложку' : 'Поставить обложку' }}
      </button>
    </div>
    <p class="mt-1.5 text-[12px] text-stone-500 dark:text-zinc-400">Широкая картинка — фон плашки кабинета и профиля компании.</p>
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
    <BusinessCoverCropDialog :crop="settings.coverCrop" :saving="settings.store.saving" @cancel="settings.cancelCoverCrop()" @confirm="settings.confirmCoverCrop()" />
  </div>
</template>
