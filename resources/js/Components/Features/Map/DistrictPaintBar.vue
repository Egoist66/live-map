<script setup lang="ts">
import Button from 'primevue/button'
import { BRUSH_SIZES } from '@/utils/districtGeo'

defineProps<{ brushRadius: number; strokesCount: number; canUndo: boolean; canFinish: boolean; touchPaint: boolean }>()
const emit = defineEmits<{
  (e: 'update:brush', v: number): void
  (e: 'toggle-touch', v: boolean): void
  (e: 'undo'): void
  (e: 'clear'): void
  (e: 'finish'): void
  (e: 'cancel'): void
}>()
</script>
<template>
  <div class="absolute inset-x-2 bottom-[calc(var(--app-bottomnav)+var(--sab)+12px)] sm:bottom-6 z-20 flex justify-center pointer-events-none">
    <div class="pointer-events-auto w-full sm:w-auto max-w-[520px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-violet-200 dark:border-violet-900/60 rounded-3xl shadow-float px-3 py-2.5">
      <div class="flex items-center gap-2">
        <span class="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-700 to-purple-900 text-white grid place-items-center shrink-0 shadow-glow"><i class="pi pi-palette text-sm" /></span>
        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-black dark:text-white leading-tight">Кисть UDistrict</div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400 leading-tight hidden sm:flex items-center gap-1">Зажми <kbd class="px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10 text-[10px] font-black text-stone-700 dark:text-zinc-200 leading-none">Alt</kbd> и веди мышью с левой кнопкой</div>
          <div class="text-[11px] text-stone-500 dark:text-zinc-400 leading-tight sm:hidden">Веди пальцем по карте</div>
          <div class="text-[11px] text-violet-700 dark:text-violet-300 leading-tight font-semibold">Обведи круг — внутри всё зальётся островком</div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            v-for="b in BRUSH_SIZES"
            :key="b.v"
            type="button"
            :title="`Кисть ${b.l}`"
            :class="['w-9 h-9 rounded-full text-xs font-black grid place-items-center border transition active:scale-95 hover:border-violet-400 dark:hover:border-violet-400/60', brushRadius === b.v ? 'bg-violet-700 text-white border-violet-700 shadow-glow hover:bg-violet-600 hover:text-white dark:hover:bg-violet-600 dark:hover:text-white' : 'bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-zinc-200 border-stone-200 dark:border-white/10 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-200']"
            @click="emit('update:brush', b.v)"
          >{{ b.l }}</button>
        </div>
      </div>
      <div class="mt-2 flex items-center gap-1.5">
        <Button :icon="touchPaint ? 'pi pi-palette' : 'pi pi-arrows-alt'" rounded outlined size="small" :title="touchPaint ? 'Кисть: рисует' : 'Карта: двигается'" :aria-label="touchPaint ? 'Кисть активна' : 'Двигать карту'" class="!w-10 !h-10 !p-0 shrink-0" :class="touchPaint ? '' : '!border-emerald-500 !text-emerald-600'" @click="emit('toggle-touch', !touchPaint)" />
        <Button icon="pi pi-undo" rounded outlined size="small" :disabled="!canUndo" title="Отменить мазок" aria-label="Отменить мазок" class="!w-10 !h-10 !p-0 shrink-0" @click="emit('undo')" />
        <Button icon="pi pi-trash" rounded outlined severity="danger" size="small" :disabled="!canUndo" title="Стереть всё" aria-label="Стереть всё" class="!w-10 !h-10 !p-0 shrink-0" @click="emit('clear')" />
        <span class="flex-1 text-center text-[11px] font-bold text-stone-500 dark:text-zinc-400">Мазков: {{ strokesCount }}</span>
        <Button icon="pi pi-times" label="Отмена" rounded outlined severity="secondary" size="small" @click="emit('cancel')" />
        <Button icon="pi pi-check" label="Готово" rounded size="small" :disabled="!canFinish" class="!bg-gradient-to-r !from-violet-700 !to-purple-900 !border-0 !shadow-glow !text-white hover:!opacity-90 hover:!brightness-110 active:scale-95 transition disabled:!opacity-50" @click="emit('finish')" />
      </div>
    </div>
  </div>
</template>
