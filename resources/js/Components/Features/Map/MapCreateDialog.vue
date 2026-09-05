<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

defineProps<{ open: boolean; pinCreate: any; categories: any[]; pinAddress: string; loadingAddress: boolean; radiusOptions: any[]; radiusLabel: string }>()
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'close'): void }>()
</script>
<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" modal :dismissableMask="true" :closable="true" header="Новый пин" :style="{ width: '540px', maxWidth: '96vw', maxHeight: '92dvh' }" :pt="{ content: { class: '!max-h-[80dvh] !overflow-y-auto' } }" @hide="emit('close')">
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
      <div class="rounded-2xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
        <button type="button" @click="pinCreate.toggleSchedule()" class="w-full flex items-center gap-3 px-3.5 py-3 text-left active:scale-[0.99] transition">
          <span :class="['w-9 h-9 rounded-xl grid place-items-center text-base shrink-0 transition', pinCreate.scheduleEnabled.value ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-glow' : 'bg-stone-100 dark:bg-zinc-800']">🕓</span>
          <span class="flex-1 min-w-0">
            <span class="block text-[13px] font-bold dark:text-zinc-100">Запланировать</span>
            <span class="block text-[11px] text-stone-500 truncate">{{ pinCreate.isScheduled.value ? `Опубликуем ${pinCreate.scheduleLabel.value}` : 'Опубликовать сейчас или позже' }}</span>
          </span>
          <span :class="['relative w-11 h-6 rounded-full transition shrink-0', pinCreate.scheduleEnabled.value ? 'bg-violet-600' : 'bg-stone-300 dark:bg-zinc-700']">
            <span :class="['absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', pinCreate.scheduleEnabled.value ? 'left-[22px]' : 'left-0.5']"></span>
          </span>
        </button>
        <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="pinCreate.scheduleEnabled.value" class="px-3.5 pb-3.5 pt-1 space-y-2.5 border-t border-dashed border-stone-200 dark:border-zinc-700">
            <div class="flex gap-1.5 pt-2.5 overflow-x-auto scrollbar-none -mx-0.5 px-0.5">
              <button type="button" @click="pinCreate.applyPreset('hour')" class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 dark:text-zinc-200 active:scale-95 transition hover:border-violet-400">+1 час</button>
              <button type="button" @click="pinCreate.applyPreset('evening')" class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 dark:text-zinc-200 active:scale-95 transition hover:border-violet-400">Сегодня в 18:00</button>
              <button type="button" @click="pinCreate.applyPreset('morning')" class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 dark:text-zinc-200 active:scale-95 transition hover:border-violet-400">Завтра в 9:00</button>
            </div>
            <input v-model="pinCreate.publish_at.value" type="datetime-local" :min="pinCreate.minScheduleLocal.value" :max="pinCreate.maxScheduleLocal.value" class="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[14px] dark:text-zinc-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition" />
            <p class="text-[11px] leading-snug text-stone-500 dark:text-zinc-400">⏱ Пин появится на карте автоматически. Cрок жизни считается с момента публикации.</p>
          </div>
        </Transition>
      </div>
      <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2">
        <Button type="button" severity="secondary" outlined rounded class="flex-1" label="Отмена" @click="emit('close')" />
        <Button :loading="pinCreate.creating" :disabled="!pinCreate.title.value?.trim()" type="submit" rounded class="flex-[1.4] !bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !shadow-glow" :label="pinCreate.creating ? 'Сохраняем…' : (pinCreate.isScheduled.value ? `Запланировать → ${pinCreate.scheduleLabel.value}` : 'Создать пин →')" />
      </div>
    </form>
  </Dialog>
</template>
<style scoped>
.scrollbar-none::-webkit-scrollbar{display:none}
.scrollbar-none{scrollbar-width:none}
input[type="datetime-local"]{color-scheme:light}
:global(.dark) input[type="datetime-local"]{color-scheme:dark}
</style>
