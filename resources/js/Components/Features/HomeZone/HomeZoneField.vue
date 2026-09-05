<script setup lang="ts">
import { computed } from 'vue'
import { usePlanLimits, requiredPlanForRadius } from '@/composables/usePlanLimits'
import Message from 'primevue/message'

const props = defineProps<{ modelValue: number | null; plan?: string | null; error?: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

const planRef = computed(() => props.plan || 'free')
const { maxHomeRadius, presets } = usePlanLimits(planRef)

const radius = computed(() => Number(props.modelValue ?? 1))
const needPlan = computed(() => requiredPlanForRadius(radius.value))
const overLimit = computed(() => radius.value > maxHomeRadius.value)

const previewSize = computed(() => {
  const r = Math.min(Math.max(radius.value, 1), 50)
  const t = Math.log(r + 1) / Math.log(51)
  return Math.round(28 + t * 92)
})

function pick(v: number) {
  if (v <= maxHomeRadius.value) emit('update:modelValue', v)
}

function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (!Number.isNaN(v)) emit('update:modelValue', Math.round(v))
}
</script>
<template>
  <div>
    <div class="flex items-center justify-between gap-2">
      <label class="text-xs font-medium dark:text-white">Радиус — зона видимости пина</label>
      <span class="text-[11px] font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-800 rounded-full px-2.5 py-1">{{ radius }} км · {{ (plan || 'free').toUpperCase() }}</span>
    </div>
    <p class="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed mt-1.5">
      Вижу чужие и мои пины в радиусе {{ radius }} км от дома — тот же радиус, что у пина.
      Общая настройка, чтобы не задавать каждый пин. Free — 1 км · Pro — 5 км · Business — 50 км.
    </p>
    <div class="grid grid-cols-5 gap-1.5 mt-2.5">
      <button
        v-for="p in presets"
        :key="p.v"
        type="button"
        :disabled="p.locked"
        @click="pick(p.v)"
        :title="p.locked ? `Нужен ${p.minPlan.toUpperCase()}` : `${p.v} км`"
        :class="[
          'rounded-full py-2 text-xs font-semibold border transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
          radius === p.v
            ? 'bg-violet-600 text-white border-violet-600 shadow-glow'
            : 'bg-white dark:bg-zinc-800 dark:text-zinc-200 border-stone-200 dark:border-zinc-700',
        ]"
      >
        {{ p.v }}<span v-if="p.locked" class="block text-[8px] font-black opacity-70 leading-none">{{ p.minPlan.toUpperCase() }}</span>
      </button>
    </div>
    <div class="flex items-center gap-3 mt-3">
      <input type="range" :min="1" :max="maxHomeRadius" :value="Math.min(radius, maxHomeRadius)" @input="onInput" class="flex-1 accent-violet-600" />
      <input type="number" :min="1" :max="maxHomeRadius" :value="radius" @input="onInput" class="w-20 rounded-2xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-bold text-center" />
    </div>
    <div class="flex items-center gap-3 mt-3 bg-violet-50/60 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50 rounded-2xl px-3 py-2.5">
      <div class="grid place-items-center shrink-0 w-[64px] h-[64px]">
        <div class="rounded-full bg-violet-500/15 border border-dashed border-violet-500/50 grid place-items-center transition-all" :style="{ width: previewSize + 'px', height: previewSize + 'px' }">
          <span class="w-2 h-2 rounded-full bg-violet-600 block"></span>
        </div>
      </div>
      <div class="text-[11px] leading-snug text-violet-900 dark:text-violet-200">
        <b>Так выглядит зона на карте</b> — нежно-фиолетовый круг r={{ radius }} км.<br />Всё внутри — вижу я, всё снаружи — нет.
      </div>
    </div>
    <Message v-if="error || overLimit" severity="error" :closable="false" class="mt-2 !text-xs">
      {{ error || `Максимум ${maxHomeRadius} км на тарифе ${(plan || 'free').toUpperCase()}. Для ${radius} км нужен ${needPlan.toUpperCase()}.` }}
    </Message>
  </div>
</template>
