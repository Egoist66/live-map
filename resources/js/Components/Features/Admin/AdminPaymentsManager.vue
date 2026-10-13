<script setup lang="ts">
import { onMounted } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_MODULE_LABELS,
  PAYMENT_PERIOD_LABELS,
  priceLabelOf,
  useAdminPayments,
} from '@/composables/useAdminPayments'

const pay = useAdminPayments()

onMounted(() => {
  void pay.load()
})

const moduleOptions = [
  { value: 'all', label: 'Все модули' },
  ...Object.entries(PAYMENT_MODULE_LABELS).map(([value, label]) => ({ value, label })),
]

const moduleChoices = Object.entries(PAYMENT_MODULE_LABELS).map(([value, label]) => ({ value, label }))
const kindChoices = Object.entries(PAYMENT_KIND_LABELS)
  .filter(([value]) => value !== 'plan_price')
  .map(([value, label]) => ({ value, label }))
const periodChoices = Object.entries(PAYMENT_PERIOD_LABELS).map(([value, label]) => ({ value, label }))

const priceColumns = [
  { key: 'monthly', label: 'Месяц (мир)' },
  { key: 'regional_monthly', label: 'Месяц (BY/RU)' },
  { key: 'yearly', label: 'Год' },
  { key: 'weekly', label: 'Неделя' },
] as const

/**
 * severity бейджа вида позиции.
 */
function kindSeverity(kind: string): string {
  if (kind === 'credit_pack') return 'success'
  if (kind === 'ad') return 'warn'
  return 'info'
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-soft">
      <div class="flex items-center gap-2.5">
        <span class="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white shrink-0"><i class="pi pi-credit-card" /></span>
        <div class="min-w-0 flex-1">
          <div class="text-base font-black text-stone-900 dark:text-white">Payments · тарифы и оплаты</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Цены меняются здесь и сразу везде: приложение, бот, витрина. Без редеплоя.</div>
        </div>
        <Button icon="pi pi-refresh" rounded outlined size="small" aria-label="Обновить" :loading="pay.state.loading" @click="pay.load()" />
        <Button icon="pi pi-file-excel" rounded outlined severity="success" size="small" aria-label="Выгрузить в Excel" :loading="pay.state.acting" @click="pay.exportFile()" />
      </div>

      <div class="mt-4 grid sm:grid-cols-2 gap-2">
        <div
          v-for="gw in pay.state.gateways"
          :key="gw.id"
          class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-3 py-2.5"
        >
          <i class="pi pi-wallet text-base text-stone-500 dark:text-zinc-400 shrink-0" />
          <div class="flex-1 min-w-0 text-sm">
            <p class="font-semibold dark:text-white truncate">{{ gw.label }}</p>
            <p class="text-xs opacity-60">точка подключения шлюза</p>
          </div>
          <Tag value="Не подключён" severity="warn" class="!text-[11px]" />
        </div>
      </div>
      <p v-if="pay.state.gatewayNote" class="mt-2 text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">{{ pay.state.gatewayNote }}</p>
    </div>

    <div class="rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-soft">
      <div class="flex items-center gap-2.5">
        <div class="min-w-0 flex-1">
          <div class="text-base font-black text-stone-900 dark:text-white">Цены тарифов</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Пустое поле = цена из config/plans.php. Ноль не ставить — Free и так бесплатен.</div>
        </div>
        <Button
          label="Сохранить цены"
          icon="pi pi-check"
          rounded
          size="small"
          :loading="pay.state.savingPrices"
          :disabled="pay.state.loading"
          @click="pay.savePrices()"
        />
      </div>

      <div class="mt-4 space-y-2">
        <div
          v-for="plan in pay.state.plans"
          :key="plan.id"
          class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-3 py-2.5"
        >
          <div class="text-sm font-black dark:text-white capitalize">{{ plan.name }}</div>
          <div class="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
            <label v-for="col in priceColumns" :key="col.key" class="block">
              <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">{{ col.label }}</span>
              <InputNumber
                v-model="plan.prices[col.key]"
                mode="currency"
                currency="USD"
                locale="en-US"
                :min-fraction-digits="2"
                placeholder="из конфига"
                class="w-full"
                input-class="w-full"
              />
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-soft">
      <div class="flex flex-wrap items-center gap-2">
        <div class="min-w-0 flex-1">
          <div class="text-base font-black text-stone-900 dark:text-white">Витрина · кредиты, фишки, реклама</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">Выключенное не продаётся. Включится — появится в каталоге приложения.</div>
        </div>
        <Select
          v-model="pay.moduleFilter.value"
          :options="moduleOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="max-w-[160px]"
          aria-label="Фильтр по модулю"
        />
        <Button label="Добавить" icon="pi pi-plus" rounded size="small" @click="pay.openCreate()" />
      </div>

      <DataTable :value="pay.visibleItems.value" size="small" striped-rows class="mt-3" responsive-layout="stack" breakpoint="640px">
        <Column header="Позиция">
          <template #body="{ data }">
            <div class="text-sm font-bold dark:text-white">{{ data.name }}</div>
            <div class="text-xs text-stone-500 dark:text-zinc-400">{{ data.description || data.key }}</div>
          </template>
        </Column>
        <Column header="Модуль">
          <template #body="{ data }">
            <Tag :value="PAYMENT_MODULE_LABELS[data.module] ?? data.module" severity="secondary" class="!text-[11px]" />
          </template>
        </Column>
        <Column header="Вид">
          <template #body="{ data }">
            <Tag :value="PAYMENT_KIND_LABELS[data.kind] ?? data.kind" :severity="kindSeverity(data.kind)" class="!text-[11px]" />
          </template>
        </Column>
        <Column header="Цена">
          <template #body="{ data }">
            <span class="text-sm font-black dark:text-white">{{ priceLabelOf(data) }}</span>
          </template>
        </Column>
        <Column header="Вкл">
          <template #body="{ data }">
            <ToggleSwitch :model-value="data.is_active" :aria-label="data.name" @update:model-value="pay.toggleActive(data)" />
          </template>
        </Column>
        <Column header="">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button icon="pi pi-pencil" rounded text size="small" aria-label="Править" @click="pay.openEdit(data)" />
              <Button icon="pi pi-trash" rounded text severity="danger" size="small" aria-label="Удалить" @click="pay.removeItem(data)" />
            </div>
          </template>
        </Column>
        <template #empty>
          <p class="py-6 text-center text-sm text-stone-500 dark:text-zinc-400">Позиций нет — добавь первую кнопкой выше.</p>
        </template>
      </DataTable>

      <Message v-if="pay.state.notice" severity="success" :closable="false" class="mt-3">{{ pay.state.notice }}</Message>
      <Message v-if="pay.state.error" severity="error" :closable="false" class="mt-3">{{ pay.state.error }}</Message>
    </div>

    <Dialog
      v-model:visible="pay.state.dialogOpen"
      modal
      dismissableMask
      :draggable="false"
      :header="pay.state.editingId === null ? 'Новая позиция' : 'Править позицию'"
      :style="{ width: '520px', maxWidth: '94vw' }"
      :pt="{ root: { class: '!rounded-[28px] !border-0 overflow-hidden' } }"
    >
      <div class="space-y-3">
        <label class="block">
          <span class="mb-1 block text-xs font-bold">Ключ (латиница, без пробелов)</span>
          <InputText v-model="pay.state.draft.key" class="w-full" placeholder="boost_1h" :disabled="pay.state.editingId !== null" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-bold">Название</span>
          <InputText v-model="pay.state.draft.name" class="w-full" placeholder="Буст анкеты · 1 час" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-bold">Описание</span>
          <Textarea v-model="pay.state.draft.description" rows="2" class="w-full" placeholder="Что получит человек" />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="mb-1 block text-xs font-bold">Модуль</span>
            <Select v-model="pay.state.draft.module" :options="moduleChoices" option-label="label" option-value="value" class="w-full" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-bold">Вид</span>
            <Select v-model="pay.state.draft.kind" :options="kindChoices" option-label="label" option-value="value" class="w-full" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-bold">Цена, $ (пусто = бесплатно)</span>
            <InputNumber v-model="pay.state.draft.price" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="2" class="w-full" input-class="w-full" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-bold">Период</span>
            <Select v-model="pay.state.draft.period" :options="periodChoices" option-label="label" option-value="value" class="w-full" />
          </label>
        </div>
        <div class="rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 px-3 py-2.5">
          <p class="text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-zinc-500">Свой ценник по тарифам (пусто = базовая цена)</p>
          <div class="mt-2 grid grid-cols-3 gap-2">
            <label class="block">
              <span class="mb-1 block text-xs font-bold">Free</span>
              <InputNumber v-model="pay.state.draft.pricesByPlan.free" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="2" class="w-full" input-class="w-full" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold">Pro</span>
              <InputNumber v-model="pay.state.draft.pricesByPlan.pro" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="2" class="w-full" input-class="w-full" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold">Premium</span>
              <InputNumber v-model="pay.state.draft.pricesByPlan.premium" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="2" class="w-full" input-class="w-full" />
            </label>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm font-semibold dark:text-white">
          <ToggleSwitch v-model="pay.state.draft.is_active" />
          Показывать в витрине
        </label>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Отмена" text rounded @click="pay.state.dialogOpen = false" />
          <Button label="Сохранить" icon="pi pi-check" rounded :loading="pay.state.acting" @click="pay.saveDraft()" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
