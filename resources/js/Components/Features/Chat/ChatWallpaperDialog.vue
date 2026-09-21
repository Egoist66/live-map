<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ColorPicker from 'primevue/colorpicker'
import InputText from 'primevue/inputtext'
import { useChatWallpaper } from '@/composables/useChatWallpaper'

const props = defineProps<{ open: boolean; conversationId?: number | null }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const wallpaper = useChatWallpaper()
const fileInput = ref<HTMLInputElement | null>(null)
const colorDraft = ref('#7c3aed')
const colorError = ref<string | null>(null)

watch(
  () => wallpaper.customColor.value,
  (next) => {
    if (next) {
      colorDraft.value = next
    }
  },
  { immediate: true },
)

/**
 * Применяет выбранный пресет как общий фон беседы.
 * @param id id пресета
 */
async function onPickPreset(id: string): Promise<void> {
  colorError.value = null
  await wallpaper.applyPreset(id)
}

/**
 * Применяет быстрый цвет из палитры.
 * @param color hex-цвет
 */
async function onPickSwatch(color: string): Promise<void> {
  colorDraft.value = color
  colorError.value = null
  await wallpaper.applyColor(color)
}

/**
 * Применяет свой hex-цвет из поля ввода.
 */
async function onApplyCustomColor(): Promise<void> {
  // ColorPicker отдаёт hex без `#`, поле ввода — с `#`: приводим к одному виду.
  const raw = colorDraft.value.trim()
  const clean = raw.startsWith('#') ? raw : `#${raw}`
  if (!/^#[0-9a-fA-F]{6}$/.test(clean)) {
    colorError.value = 'Цвет в формате #rrggbb, например #7c3aed'
    return
  }
  colorError.value = null
  await wallpaper.applyColor(clean)
}

/**
 * Загружает свою картинку как общий фон беседы.
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
  colorError.value = null
  await wallpaper.uploadCustom(file)
}

/**
 * Убирает общий фон беседы у всех участников.
 */
async function onReset(): Promise<void> {
  colorError.value = null
  await wallpaper.resetWallpaper()
}
</script>
<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" modal header="Фон чата" :style="{ width: '440px', maxWidth: '94vw' }" :pt="{ content: { class: '!pt-1' } }">
    <p class="text-xs text-stone-500 dark:text-zinc-400 mb-3">Фон общий для беседы — смена применяется у обоих собеседников сразу.</p>
    <div v-if="!props.conversationId" class="mb-3">
      <Message severity="warn" :closable="false" class="!rounded-2xl !text-xs">Откройте диалог, чтобы сменить фон.</Message>
    </div>
    <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 mb-1.5">Градиенты</div>
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="preset in wallpaper.presets"
        :key="preset.id"
        @click="onPickPreset(preset.id)"
        :disabled="!props.conversationId || wallpaper.isSaving.value"
        :aria-label="preset.label"
        :class="['flex flex-col gap-1.5 rounded-2xl border p-1.5 transition active:scale-95 disabled:opacity-50', wallpaper.activePresetId.value === preset.id ? '!border-violet-600 ring-2 ring-violet-600/30' : 'border-stone-200 dark:border-zinc-700 hover:border-violet-400']"
      >
        <span :style="preset.css ? { background: preset.css } : {}" :class="['h-16 rounded-xl', preset.css ? '' : 'bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 grid place-items-center text-stone-400 text-lg']">
          <i v-if="!preset.css" class="pi pi-ban"></i>
        </span>
        <span class="text-[11px] font-semibold text-center truncate dark:text-zinc-200">{{ preset.label }}</span>
      </button>
    </div>

    <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 mt-4 mb-1.5">Цвет</div>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="color in wallpaper.colors"
        :key="color"
        @click="onPickSwatch(color)"
        :disabled="!props.conversationId || wallpaper.isSaving.value"
        :aria-label="`Цвет ${color}`"
        :style="{ background: color }"
        :class="['w-9 h-9 rounded-full border transition active:scale-95 disabled:opacity-50', wallpaper.isColorActive.value && wallpaper.customColor.value === color ? 'border-violet-600 ring-2 ring-violet-600/40 ring-offset-2' : 'border-black/10 dark:border-white/20 hover:scale-110']"
      />
    </div>
    <div class="flex items-center gap-2 mt-2.5">
      <ColorPicker v-model="colorDraft" format="hex" :disabled="!props.conversationId || wallpaper.isSaving.value" />
      <InputText v-model="colorDraft" placeholder="#7c3aed" maxlength="7" :disabled="!props.conversationId || wallpaper.isSaving.value" class="!rounded-xl !text-sm flex-1 min-w-0" />
      <Button label="Ок" rounded size="small" :disabled="!props.conversationId || wallpaper.isSaving.value" @click="onApplyCustomColor" />
    </div>
    <p v-if="colorError" class="text-[11px] text-red-600 dark:text-red-400 mt-1.5">{{ colorError }}</p>
    <div v-else-if="wallpaper.isColorActive.value" class="text-[11px] text-stone-500 dark:text-zinc-400 mt-1.5">Сейчас: <span class="font-mono font-bold">{{ wallpaper.customColor.value }}</span> — видно обоим.</div>

    <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 mt-4 mb-1.5">Своя картинка</div>
    <button
      @click="fileInput?.click()"
      :disabled="!props.conversationId || wallpaper.isSaving.value"
      aria-label="Свой фон"
      :class="['w-full flex items-center gap-3 rounded-2xl border p-1.5 pr-3 transition active:scale-[0.99] disabled:opacity-50 overflow-hidden text-left', wallpaper.isCustomActive.value ? '!border-violet-600 ring-2 ring-violet-600/30' : 'border-dashed border-stone-300 dark:border-zinc-600 hover:border-violet-400']"
    >
      <span class="h-16 w-24 rounded-xl overflow-hidden grid place-items-center bg-violet-50 dark:bg-violet-500/10 text-violet-500 shrink-0">
        <img v-if="wallpaper.customImageUrl.value" :src="wallpaper.customImageUrl.value" alt="" class="w-full h-full object-cover" />
        <i v-else class="pi pi-plus text-lg"></i>
      </span>
      <span class="min-w-0">
        <span class="block text-xs font-bold dark:text-zinc-100">{{ wallpaper.customImageUrl.value ? 'Картинка установлена' : 'Загрузить картинку' }}</span>
        <span class="block text-[11px] text-stone-500 dark:text-zinc-400">До 5 МБ · сохраняется на сервере, видна обоим</span>
      </span>
    </button>
    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" @change="onPickFile" />
    <div v-if="wallpaper.isSaving.value" class="mt-3 flex items-center gap-2 text-xs text-stone-500">
      <span class="w-4 h-4 border-2 border-stone-200 border-t-violet-600 rounded-full animate-spin"></span>
      Сохраняем фон…
    </div>
    <Message v-if="wallpaper.saveError.value" severity="error" :closable="false" class="!rounded-2xl !text-xs mt-3">{{ wallpaper.saveError.value }}</Message>
    <div class="flex gap-2 mt-4">
      <Button label="Убрать фон" icon="pi pi-trash" outlined rounded size="small" class="flex-1" :loading="wallpaper.isSaving.value" :disabled="!props.conversationId" @click="onReset" />
      <Button label="Готово" icon="pi pi-check" rounded size="small" class="flex-1" @click="emit('update:open', false)" />
    </div>
  </Dialog>
</template>
