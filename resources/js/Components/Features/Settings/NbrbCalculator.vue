<script setup lang="ts">
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import { computed } from 'vue'
import { useNbrb } from '@/composables/useNbrb'

const props = defineProps<{ modelAmount?: number }>()
const emit = defineEmits<{ (e: 'use-amount', v: number): void }>()

const n = useNbrb()
if (props.modelAmount) n.amount.value = props.modelAmount
const dateObj = computed({
  get: () => (n.ondate.value ? new Date(n.ondate.value + 'T12:00:00') : null),
  set: (d: Date | null) => { n.ondate.value = d ? d.toISOString().slice(0, 10) : ''; onCalc() },
})

async function init() {
  await n.loadCurrencies()
  await n.convert()
}
init()

async function onCalc() {
  await n.convert()
}

function onInput() {
  n.convertDebounced()
}
</script>
<template>
  <div class="mt-4 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-bold uppercase tracking-wide text-stone-500">Калькулятор · курс НБРБ</p>
      <span v-if="n.convertResult.value" class="text-[11px] text-stone-400">на {{ new Date(n.convertResult.value.date).toLocaleDateString('ru-BY') }}</span>
    </div>
    <div class="mt-2 grid grid-cols-[1fr_130px] sm:grid-cols-[1fr_150px_150px_auto] gap-2">
      <InputNumber v-model="n.amount.value" :min="0" :max-fraction-digits="2" placeholder="Сумма" class="w-full" input-class="!rounded-xl w-full" @update:model-value="onInput" />
      <Select
        v-model="n.curCode.value"
        :options="n.currencyOptions.value"
        placeholder="USD"
        class="w-full !rounded-xl"
        @update:model-value="onCalc"
      />
      <DatePicker v-model="dateObj" date-format="yy-mm-dd" placeholder="Дата" class="w-full max-sm:col-span-2" input-class="!rounded-xl w-full" />
      <Button label="=" class="!rounded-xl max-sm:col-span-2" :loading="n.converting.value" @click="onCalc" />
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span v-if="n.converting.value" class="text-stone-400">Считаем…</span>
      <span v-else-if="n.convertResult.value" class="font-bold dark:text-white">
        {{ n.amount.value }} {{ n.convertResult.value.from }} ≈ {{ n.convertResult.value.byn }} BYN
      </span>
      <span v-if="n.convertResult.value" class="text-xs text-stone-500">
        1 {{ n.convertResult.value.from }} = {{ n.convertResult.value.per_unit.toFixed(4) }} BYN ({{ n.convertResult.value.cur_scale }} → {{ n.convertResult.value.official_rate }})
      </span>
      <button
        v-if="n.curCode.value === 'USD' && n.convertResult.value"
        type="button"
        class="ml-auto text-xs underline underline-offset-2 text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200"
        @click="emit('use-amount', n.amount.value)"
      >
        использовать для доната
      </button>
    </div>
    <p v-if="n.error.value" class="mt-1 text-xs text-rose-500">{{ n.error.value }}</p>
  </div>
</template>
