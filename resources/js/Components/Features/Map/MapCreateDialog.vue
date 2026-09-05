<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { BLUR_OPTIONS } from '@/composables/useLocationBlur'

defineProps<{ open: boolean; pinCreate: any; categories: any[]; pinAddress: string; loadingAddress: boolean; radiusOptions: any[]; radiusLabel: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'close'): void }>()
</script>
<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" modal :dismissableMask="true" :closable="true" header="Новый пин" :style="{ width: '520px', maxWidth: '96vw', maxHeight: '92dvh' }" :pt="{ content: { class: '!max-h-[80dvh] !overflow-y-auto' } }" @hide="emit('close')">
    <template #header><div><div class="text-[16px] font-black">Новый пин</div><div class="text-[11px] text-stone-500">Клик по карте — переместить точку</div></div></template>
    <form @submit.prevent="pinCreate.submit" class="p-4 sm:p-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-3">
      <div class="bg-stone-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
        <div class="min-w-0 flex-1">
          <div class="text-[12px] font-semibold leading-tight truncate">
            <span v-if="loadingAddress" class="text-stone-400">Определяем адрес…</span>
            <span v-else-if="pinCreate.showCoords.value" class="font-mono">{{ (pinCreate.values as any).latitude?.toFixed(5) }}, {{ (pinCreate.values as any).longitude?.toFixed(5) }}</span>
            <span v-else>{{ pinAddress || 'Адрес не определён' }}</span>
          </div>
          <div class="text-[10px] text-stone-400 mt-0.5 truncate">кликни → переместить</div>
        </div>
      </div>
      <div>
        <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Заголовок *</label>
        <InputText v-model="pinCreate.title.value" v-bind="pinCreate.titleAttrs" placeholder="Напр. Отдам стул, где кофе?" maxlength="100" class="w-full mt-1 !rounded-2xl" />
        <small class="text-red-500 text-xs">{{ pinCreate.errors.value.title }}</small>
      </div>
      <div>
        <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Подробности</label>
        <Textarea v-model="pinCreate.body.value" placeholder="Адрес, время, контакты…" rows="2" autoResize maxlength="1000" class="w-full mt-1 !rounded-2xl" />
        <small class="text-red-500 text-xs">{{ pinCreate.errors.value.body }}</small>
      </div>
      <div>
        <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Категория</label>
        <div class="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          <button v-for="c in categories" :key="c.v" type="button" @click="(pinCreate.category.value as any) = c.v" :class="['px-2 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95', (pinCreate.category.value as any) === c.v ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-transparent shadow-glow' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-ink-900 dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-white/10']">
            <span class="text-sm leading-none">{{ c.i }}</span><span class="leading-none text-[11px]">{{ c.l }}</span>
          </button>
        </div>
      </div>
      <div>
        <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Точность места</label>
        <div class="mt-1.5 grid grid-cols-4 gap-1.5">
          <button v-for="o in BLUR_OPTIONS" :key="o.v" type="button" @click="(pinCreate.location_precision.value as any) = o.v" :class="['px-1 py-2 rounded-xl border text-center transition active:scale-95', (pinCreate.values as any).location_precision === o.v ? 'bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-ink-900 dark:text-zinc-100']">
            <span class="block text-[11px] font-bold leading-none">{{ o.l }}</span><span class="block text-[9px] opacity-60 leading-none mt-1">{{ o.d }}</span>
          </button>
        </div>
        <div v-if="(pinCreate.values as any).location_precision === 'custom'" class="mt-2">
          <div class="flex items-center justify-between text-[11px] text-stone-500"><span>Сдвиг точки</span><span class="font-bold text-stone-800 dark:text-zinc-100">{{ (pinCreate.values as any).blur_meters ?? 200 }} м</span></div>
          <input type="range" min="0" max="5000" step="50" :value="(pinCreate.values as any).blur_meters ?? 200" @input="(pinCreate.blur_meters.value as any) = Number(($event.target as HTMLInputElement).value)" class="w-full mt-1 accent-stone-900" />
        </div>
      </div>
      <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Button type="button" severity="secondary" outlined rounded class="flex-1" label="Отмена" @click="emit('close')" />
        <Button :loading="pinCreate.creating" :disabled="!pinCreate.title.value?.trim()" type="submit" rounded class="flex-[1.4] !bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !shadow-glow" :label="pinCreate.creating ? 'Создаём…' : 'Создать пин →'" />
      </div>
    </form>
  </Dialog>
</template>
