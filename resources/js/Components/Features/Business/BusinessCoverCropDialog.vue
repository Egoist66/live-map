<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Slider from 'primevue/slider'
import type { CoverCropper } from '@/composables/useCoverCropper'

defineProps<{ crop: CoverCropper; saving: boolean }>()
const emit = defineEmits<{ (e: 'cancel'): void; (e: 'confirm'): void }>()
</script>
<template>
  <Dialog
    :visible="crop.showCropper.value"
    @update:visible="(v:boolean)=>{ if(!v) emit('cancel') }"
    modal
    dismissableMask
    :draggable="false"
    header="Обложка компании"
    :style="{ width: '560px', maxWidth: 'calc(100vw - 1.5rem)' }"
    :pt="{ root: { class: '!rounded-3xl !bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-700 overflow-hidden' }, header: { class: '!py-3 !px-4' }, title: { class: '!font-black !text-[16px]' }, content: { class: '!px-4 !pb-2 !overflow-y-auto !overscroll-contain' }, footer: { class: '!px-4 !py-3' } }"
  >
    <div
      :ref="(el:any)=>crop.setFrameEl(el)"
      class="relative w-full aspect-[3/1] overflow-hidden rounded-2xl bg-stone-100 dark:bg-zinc-800 select-none touch-none"
      :class="crop.dragging.value ? 'cursor-grabbing' : 'cursor-grab'"
      @pointerdown="crop.onPointerDown"
      @pointermove="crop.onPointerMove"
      @pointerup="crop.onPointerUp"
      @pointercancel="crop.onPointerUp"
    >
      <img v-if="crop.sourceUrl.value" :src="crop.sourceUrl.value" alt="" draggable="false" class="absolute max-w-none" :style="crop.frameStyle.value" />
      <div class="absolute inset-0 pointer-events-none grid grid-cols-3">
        <div v-for="i in 3" :key="i" class="border-x border-white/30 first:border-l-0 last:border-r-0"></div>
      </div>
    </div>
    <p class="text-xs text-stone-500 dark:text-zinc-400 mt-2">Большая картинка режется под баннер 3:1 — тяни, чтобы выбрать видимую часть, ползунок — приблизить.</p>
    <div class="flex items-center gap-1 mt-2">
      <Button icon="pi pi-minus" rounded text aria-label="Отдалить" @click="crop.zoomOut()" :disabled="crop.zoom.value <= crop.ZOOM_MIN" class="!w-10 !h-10 shrink-0" />
      <Slider v-model="crop.zoom.value" :min="crop.ZOOM_MIN" :max="crop.ZOOM_MAX" :step="0.01" class="flex-1" aria-label="Масштаб обложки" />
      <Button icon="pi pi-plus" rounded text aria-label="Приблизить" @click="crop.zoomIn()" :disabled="crop.zoom.value >= crop.ZOOM_MAX" class="!w-10 !h-10 shrink-0" />
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="Отмена" severity="secondary" text @click="emit('cancel')" />
        <Button label="Поставить обложку" icon="pi pi-check" :loading="saving || crop.confirming.value" @click="emit('confirm')" class="!bg-indigo-600 !border-indigo-600 hover:!bg-indigo-500" />
      </div>
    </template>
  </Dialog>
</template>
