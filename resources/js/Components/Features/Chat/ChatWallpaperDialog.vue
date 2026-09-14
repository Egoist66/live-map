<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useChatWallpaper } from '@/composables/useChatWallpaper'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const wallpaper = useChatWallpaper()
const fileInput = ref<HTMLInputElement | null>(null)

/**
 * Применяет выбранный пресет.
 * @param id id пресета
 */
async function onPickPreset(id: string): Promise<void> {
  await wallpaper.applyPreset(id)
}

/**
 * Загружает свою картинку как фон.
 * @param event событие change файлового инпута
 */
async function onPickFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null
  if (input) {
    input.value = ''
  }
  if (!file) {
    return
  }
  await wallpaper.uploadCustom(file)
}

/**
 * Сбрасывает фон к стандартному.
 */
async function onReset(): Promise<void> {
  await wallpaper.resetWallpaper()
}
</script>
<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" modal header="Фон чата" :style="{ width: '440px', maxWidth: '94vw' }" :pt="{ content: { class: '!pt-1' } }">
    <p class="text-xs text-stone-500 dark:text-zinc-400 mb-3">Фон видишь только ты, у каждого свой. Хранится на этом устройстве.</p>
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="preset in wallpaper.presets"
        :key="preset.id"
        @click="onPickPreset(preset.id)"
        :aria-label="preset.label"
        :class="['flex flex-col gap-1.5 rounded-2xl border p-1.5 transition active:scale-95', wallpaper.activePresetId.value === preset.id ? '!border-violet-600 ring-2 ring-violet-600/30' : 'border-stone-200 dark:border-zinc-700 hover:border-violet-400']"
      >
        <span :style="preset.css ? { background: preset.css } : {}" :class="['h-16 rounded-xl', preset.css ? '' : 'bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 grid place-items-center text-stone-400 text-lg']">
          <i v-if="!preset.css" class="pi pi-ban"></i>
        </span>
        <span class="text-[11px] font-semibold text-center truncate dark:text-zinc-200">{{ preset.label }}</span>
      </button>
      <button
        @click="fileInput?.click()"
        aria-label="Свой фон"
        :class="['flex flex-col gap-1.5 rounded-2xl border p-1.5 transition active:scale-95 overflow-hidden', wallpaper.isCustomActive.value ? '!border-violet-600 ring-2 ring-violet-600/30' : 'border-dashed border-stone-300 dark:border-zinc-600 hover:border-violet-400']"
      >
        <span class="h-16 rounded-xl overflow-hidden grid place-items-center bg-violet-50 dark:bg-violet-500/10 text-violet-500">
          <img v-if="wallpaper.customImageUrl.value" :src="wallpaper.customImageUrl.value" alt="" class="w-full h-full object-cover" />
          <i v-else class="pi pi-plus text-lg"></i>
        </span>
        <span class="text-[11px] font-semibold text-center truncate dark:text-zinc-200">Свой фон</span>
      </button>
    </div>
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPickFile" />
    <div v-if="wallpaper.isSaving.value" class="mt-3 flex items-center gap-2 text-xs text-stone-500">
      <span class="w-4 h-4 border-2 border-stone-200 border-t-violet-600 rounded-full animate-spin"></span>
      Сохраняем картинку…
    </div>
    <Message v-if="wallpaper.saveError.value" severity="error" :closable="false" class="!rounded-2xl !text-xs mt-3">{{ wallpaper.saveError.value }}</Message>
    <div class="flex gap-2 mt-4">
      <Button label="Убрать фон" icon="pi pi-trash" outlined rounded size="small" class="flex-1" :loading="wallpaper.isSaving.value" @click="onReset" />
      <Button label="Готово" icon="pi pi-check" rounded size="small" class="flex-1" @click="emit('update:open', false)" />
    </div>
</Dialog>
</template>
