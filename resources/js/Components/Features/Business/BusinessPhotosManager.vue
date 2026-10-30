<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useBusinessPhotos, BUSINESS_PHOTOS_LIMIT } from '@/composables/useBusinessPhotos'

const props = defineProps<{ businessId: number | null }>()

const manager = useBusinessPhotos()
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  if (props.businessId) {
    void manager.load(props.businessId)
  }
})

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
  await manager.upload(file)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2">
      <div class="text-[13px] text-stone-500 dark:text-zinc-400">До {{ BUSINESS_PHOTOS_LIMIT }} фото · листаются в пинах на карте</div>
      <div class="text-[13px] font-bold text-stone-500 dark:text-zinc-400 shrink-0">{{ manager.photos.value.length }}/{{ BUSINESS_PHOTOS_LIMIT }}</div>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />

    <div v-if="manager.loading.value" class="mt-3 grid grid-cols-3 gap-2">
      <Skeleton v-for="i in 3" :key="i" class="!rounded-2xl !aspect-square !h-auto" />
    </div>
    <div v-else class="mt-3 grid grid-cols-3 gap-2">
      <div
        v-for="photo in manager.photos.value"
        :key="photo.id"
        class="relative rounded-2xl overflow-hidden bg-stone-100 dark:bg-white/[0.06] aspect-square group"
      >
        <img :src="photo.url ?? ''" :alt="photo.caption ?? 'Фото компании'" class="w-full h-full object-cover" loading="lazy" />
        <button
          type="button"
          aria-label="Удалить фото"
          class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white grid place-items-center text-xs hover:bg-red-500 transition"
          @click="manager.remove(photo.id)"
        >
          <i class="pi pi-times text-[10px]" />
        </button>
      </div>
      <button
        v-if="manager.canAdd.value"
        type="button"
        :disabled="manager.uploading.value"
        class="rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 aspect-square grid place-items-center text-indigo-500 dark:text-indigo-300 hover:border-indigo-500 transition active:scale-[0.98] disabled:opacity-60"
        @click="openPicker"
      >
        <span class="text-center px-2">
          <span class="block text-2xl leading-none">{{ manager.uploading.value ? '…' : '+' }}</span>
          <span class="block text-[11px] font-bold mt-1">{{ manager.uploading.value ? 'Загрузка…' : 'Добавить' }}</span>
        </span>
      </button>
    </div>

    <Button
      v-if="manager.canAdd.value && manager.photos.value.length > 0"
      label="Добавить ещё"
      icon="pi pi-plus"
      text
      rounded
      size="small"
      class="mt-2"
      :loading="manager.uploading.value"
      @click="openPicker"
    />
  </div>
</template>
