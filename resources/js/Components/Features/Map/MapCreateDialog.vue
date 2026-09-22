<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import { usePinAudience } from '@/composables/usePinAudience'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useBusinessAccount } from '@/composables/useBusinessAccount'
import { SOS_WARNING_TEXT, SOS_WARNING_TITLE } from '@/composables/useSosConfirm'

const { isBusiness } = useBusinessAccount()

const props = withDefaults(defineProps<{ open: boolean; pinCreate: any; customCats: any; categories: any[]; pinAddress: string; loadingAddress: boolean; radiusOptions: any[]; radiusLabel?: string; sosLimits?: { used: number; limit: number; left: number; is_pro: boolean } | null }>(), { radiusLabel: '1 км', sosLimits: null })
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'close'): void; (e: 'delete-custom-category', slug: string): void }>()
const audience = usePinAudience()
const { selectPt } = useDropdownMenuStyle()
async function createCustomAndSelect() {
  const d = await props.customCats.createFromDraft()
  if (d) props.pinCreate.setValues({ category: d.slug } as any)
}

</script>
<template>
  <Dialog :visible="open" @update:visible="(v:boolean)=>emit('update:open', v)" modal :dismissableMask="true" :closable="true" header="Новый пин" :style="{ width: '540px', maxWidth: '96vw', maxHeight: '92dvh' }" :pt="{ content: { class: '!max-h-[80dvh] !overflow-y-auto' } }" @hide="emit('close')">
    <template #header><div><div class="text-[16px] font-black">Новый пин</div><div class="text-[11px] text-stone-500">Клик по карте — переместить точку</div></div></template>
    <form @submit.prevent="pinCreate.submit" class="p-4 sm:p-5 pb-[calc(1rem+var(--sab))] space-y-3">
      <div v-if="Number((pinCreate.values as any)?.district_id) > 0" class="bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-xl px-3 py-2.5 text-xs leading-snug text-violet-800 dark:text-violet-200">🏘️ Пин района · увидят только жители в своей зоне<button type="button" class="ml-2 underline font-bold" @click="pinCreate.setDistrict(null)">сделать обычным</button></div>
      <div v-if="pinCreate.isUnlimited?.value" class="bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 rounded-xl px-3 py-2.5 text-xs leading-snug text-violet-800 dark:text-violet-200">∞ Безлимит · пин живёт {{ pinCreate.ttlLabel?.value ?? '∞' }}</div>
      <div v-else-if="pinCreate.limitExceeded.value" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5 text-xs leading-snug text-stone-700 dark:text-amber-100">⚠️ {{ pinCreate.limitWarning.value }}</div>
      <div v-else class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-xs leading-snug text-stone-600 dark:text-zinc-300">📌 {{ pinCreate.limitStatus.value }}</div>
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
      <div v-if="isBusiness" class="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
        <label class="text-[10px] font-bold tracking-wide uppercase text-indigo-600 dark:text-indigo-300">Промо-подпись · видна на карте</label>
        <InputText v-model="pinCreate.promo.value" placeholder="Напр. −20% сегодня до 22:00" maxlength="140" class="w-full mt-1 !rounded-2xl" />
        <small class="text-red-500 text-xs">{{ pinCreate.errors.value.promo }}</small>
        <p class="text-[11px] text-indigo-500 dark:text-indigo-300 mt-1">Короткий завлекающий текст под пином — видят все рядом. Необязательно.</p>
      </div>
      <div>
        <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Категория</label>
        <div class="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          <button v-for="c in categories" :key="c.v" type="button" @click="pinCreate.selectCategory(c.v)" :class="['px-2 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition active:scale-95', (pinCreate.category.value as any) === c.v ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-transparent shadow-glow' : 'bg-white dark:bg-white/[0.06] border-stone-200 dark:border-white/10 text-ink-900 dark:text-zinc-100 hover:bg-stone-50 dark:hover:bg-white/10']">
            <span class="text-sm leading-none">{{ c.i }}</span><span class="leading-none text-[11px]">{{ c.l }}</span>
          </button>
        </div>
        <div v-if="customCats?.canCreate.value" class="mt-1.5">
          <button type="button" @click="customCats.draftOpen.value = !customCats.draftOpen.value" class="w-full px-2 py-2 rounded-xl border border-dashed border-violet-400 dark:border-violet-500 text-xs font-bold text-violet-700 dark:text-violet-300 flex items-center justify-center gap-1.5 transition active:scale-95 hover:bg-violet-50 dark:hover:bg-violet-950/40">＋ Своя категория</button>
          <div v-if="customCats.draftOpen.value" class="mt-1.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20 p-2.5 space-y-2">
            <InputText v-model="customCats.draftLabel.value" placeholder="Название, напр. Рыбалка" maxlength="24" class="w-full !rounded-xl" />
            <div class="flex gap-1 flex-wrap">
              <button v-for="ic in customCats.icons" :key="ic" type="button" @click="customCats.draftIcon.value = ic" :class="['w-9 h-9 rounded-xl grid place-items-center text-lg border transition active:scale-95', customCats.draftIcon.value === ic ? 'border-violet-500 bg-white dark:bg-zinc-800 shadow' : 'border-stone-200 dark:border-zinc-700 bg-white/60 dark:bg-white/[0.04]']">{{ ic }}</button>
            </div>
            <div class="flex gap-1.5 flex-wrap">
              <button v-for="cl in customCats.colors" :key="cl" type="button" @click="customCats.draftColor.value = cl" :class="['w-8 h-8 rounded-full border-2 transition active:scale-95', customCats.draftColor.value === cl ? 'border-stone-900 dark:border-white scale-110' : 'border-white/60']" :style="{ background: cl }"></button>
            </div>
            <small v-if="customCats.draftError.value" class="text-red-500 text-xs block">{{ customCats.draftError.value }}</small>
            <Button type="button" label="Создать и выбрать" rounded size="small" class="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white w-full" :loading="customCats.draftSaving.value" @click="createCustomAndSelect" />
          </div>
          <div v-if="(customCats.defs.value || []).filter((d:any) => d.is_owner).length" class="mt-1.5 flex gap-1.5 flex-wrap">
            <span v-for="d in (customCats.defs.value || []).filter((x:any) => x.is_owner)" :key="d.slug" class="inline-flex items-center gap-1 text-[11px] font-semibold bg-white dark:bg-white/[0.06] border border-stone-200 dark:border-white/10 rounded-full pl-2.5 pr-1 py-1">{{ d.icon }} {{ d.label }}<button type="button" @click="emit('delete-custom-category', d.slug)" class="w-4 h-4 rounded-full grid place-items-center text-stone-400 hover:text-red-500"><i class="pi pi-times text-[8px]"></i></button></span>
          </div>
        </div>
        <div v-else class="mt-1.5 text-[11px] leading-snug text-stone-400 dark:text-zinc-500 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl px-3 py-2">⭐ Свои категории — на тарифе Pro и выше</div>
        <div v-if="String((pinCreate.category as any)?.value ?? '') === 'sos'" class="mt-1.5 text-[11px] leading-snug rounded-xl px-3 py-2 border" :class="(sosLimits?.left ?? 1) > 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' : 'bg-stone-100 dark:bg-zinc-800 border-stone-300 dark:border-zinc-600 text-stone-500 dark:text-zinc-400'">🆘 SOS в этом месяце: {{ sosLimits?.used ?? 0 }}/{{ sosLimits?.limit ?? 1 }} · Free — 1, PRO — 3</div>
      </div>
      <div>
        <label class="text-[10px] font-bold tracking-wide uppercase text-stone-500">Кто видит</label>
        <Select v-model="pinCreate.gender_audience.value" :options="audience.options" optionLabel="label" optionValue="value" checkmark fluid class="w-full mt-1" :pt="selectPt" />
        <p class="text-[11px] text-stone-500 dark:text-zinc-400 mt-1">По умолчанию — все. Можно ограничить: только женщины / только мужчины.</p>
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
        <Button :loading="pinCreate.creating.value" :disabled="!pinCreate.title.value?.trim() || pinCreate.limitExceeded.value" type="submit" rounded class="flex-[1.4] !bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !shadow-glow" :label="pinCreate.limitExceeded.value ? 'Лимит исчерпан' : (pinCreate.creating.value ? 'Сохраняем…' : (pinCreate.isScheduled.value ? `Запланировать → ${pinCreate.scheduleLabel.value}` : 'Создать пин →'))" />
      </div>
    </form>
    <Dialog :visible="pinCreate.sos.showSosWarning.value" @update:visible="(v:boolean)=>{ if (!v) pinCreate.sos.cancelSos() }" modal :closable="false" :draggable="false" header="SOS" :style="{ width: '420px', maxWidth: 'calc(100vw - 2rem)' }" :pt="{ root: { class: '!rounded-3xl !border-red-200 dark:!border-red-900' } }">
      <div class="flex items-start gap-3">
        <span class="w-11 h-11 rounded-2xl bg-red-500/15 text-red-500 grid place-items-center text-xl shrink-0">🆘</span>
        <div>
          <div class="text-[15px] font-black text-stone-900 dark:text-white">{{ SOS_WARNING_TITLE }}</div>
          <p class="mt-1.5 text-[13px] leading-relaxed text-stone-600 dark:text-zinc-300">{{ SOS_WARNING_TEXT }}</p>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <Button label="Отмена" severity="secondary" outlined rounded size="small" @click="pinCreate.sos.cancelSos()" />
          <Button label="Осознаю ответственность" severity="danger" rounded size="small" @click="pinCreate.sos.confirmSos()" />
        </div>
      </template>
    </Dialog>
  </Dialog>
</template>
<style scoped>
.scrollbar-none::-webkit-scrollbar{display:none}
.scrollbar-none{scrollbar-width:none}
input[type="datetime-local"]{color-scheme:light}
:global(.dark) input[type="datetime-local"]{color-scheme:dark}
</style>
