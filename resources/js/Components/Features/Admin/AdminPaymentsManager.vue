<script setup lang="ts">
import { onMounted } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import FileUpload from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import {
  PAYMENT_KIND_HINTS,
  PAYMENT_KIND_LABELS,
  PAYMENT_MODULE_HINTS,
  PAYMENT_MODULE_LABELS,
  PAYMENT_PERIOD_HINTS,
  PAYMENT_PERIOD_LABELS,
  PLAN_AUDIENCE_LABELS,
  planMonthlyLabel,
  priceLabelOf,
  useAdminPayments,
} from '@/composables/useAdminPayments'

/** Название тарифа по id (для подписей цен). */
function planNameOf(id: string): string {
  return pay.state.plans.find((p) => p.id === id)?.name ?? id
}

/** Заголовок диалога человеческим языком. */
function dialogTitle(): string {
  const draft = pay.state.draft
  const isNew = pay.state.editingId === null
  if (draft.kind === 'feature') {
    return isNew ? `Новое в тарифе «${planNameOf(draft.plan)}»` : 'Изменить возможность'
  }
  return isNew ? 'Новый товар' : 'Изменить товар'
}

/** Краткая сводка своих цен по тарифам, когда блок свёрнут. */
function ownPricesSummary(): string {
  const entries = (['free', 'pro', 'premium', 'business'] as const)
    .filter((id) => pay.state.draft.pricesByPlan[id] != null)
    .map((id) => planNameOf(id))
  if (entries.length === 0) return 'Сейчас цена одна для всех.'
  return `Своя цена: ${entries.join(', ')}.`
}

const pay = useAdminPayments()

onMounted(() => {
  void pay.load()
})

const moduleOptions = [
  { value: 'all', label: 'Все разделы' },
  ...Object.entries(PAYMENT_MODULE_LABELS).map(([value, label]) => ({ value, label })),
]

const moduleChoices = Object.entries(PAYMENT_MODULE_LABELS).map(([value, label]) => ({ value, label }))
const kindChoices = Object.entries(PAYMENT_KIND_LABELS)
  .filter(([value]) => value !== 'plan_price')
  .map(([value, label]) => ({ value, label }))
const periodChoices = Object.entries(PAYMENT_PERIOD_LABELS).map(([value, label]) => ({ value, label }))

const priceColumns = [
  { key: 'monthly', label: 'В месяц', hint: 'Одна цена для всех стран' },
  { key: 'yearly', label: 'Сразу на год', hint: 'Выгодно на 12 месяцев' },
  { key: 'weekly', label: 'На неделю', hint: 'Для быстрого решения' },
] as const

/**
 * Сохранить всё по тарифам: названия, описания и цены.
 */
async function saveAllPlans(): Promise<void> {
  await pay.saveAll()
}

/**
 * Цвет бейджа вида позиции.
 */
function kindSeverity(kind: string): string {
  if (kind === 'credit_pack') return 'success'
  if (kind === 'ad') return 'warn'
  return 'info'
}
</script>

<template>
  <div class="space-y-3 sm:space-y-4">
    <!-- Шапка раздела -->
    <section class="rounded-3xl border border-stone-200 bg-white p-4 shadow-soft sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex flex-wrap items-center gap-2.5">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <i class="pi pi-credit-card" />
        </span>
        <div class="min-w-0 flex-1 basis-40">
          <p class="text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
            Цены и списки «что входит» меняются здесь и сразу видны везде: в приложении и в боте.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <Button
            icon="pi pi-info-circle"
            rounded
            outlined
            size="small"
            aria-label="Как работать с тарифами"
            @click="pay.state.helpOpen = true"
          />
          <Button icon="pi pi-refresh" rounded outlined size="small" aria-label="Обновить" :loading="pay.state.loading" @click="pay.load()" />
          <Button
            icon="pi pi-file-excel"
            rounded
            outlined
            severity="success"
            size="small"
            aria-label="Скачать таблицу"
            v-tooltip.bottom="'Скачать Excel: тарифы, фишки и витрина'"
            :loading="pay.state.acting"
            @click="pay.exportFile()"
          />
          <Button
            icon="pi pi-upload"
            rounded
            outlined
            severity="info"
            size="small"
            aria-label="Загрузить таблицу"
            v-tooltip.bottom="'Загрузить Excel обратно'"
            :disabled="pay.state.importing"
            @click="pay.openImport()"
          />
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          v-for="gw in pay.state.gateways"
          :key="gw.id"
          class="flex items-center gap-3 rounded-2xl border border-stone-200/70 px-3 py-2.5 dark:border-zinc-800"
        >
          <i class="pi pi-wallet shrink-0 text-base text-stone-400 dark:text-zinc-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-stone-800 dark:text-zinc-100">{{ gw.label }}</p>
            <p class="text-xs text-stone-500 dark:text-zinc-400">Автоматическая оплата скоро появится</p>
          </div>
          <Tag value="Не подключён" severity="warn" class="!text-[11px] shrink-0" />
        </div>
      </div>
      <p v-if="pay.state.gatewayNote" class="mt-2 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">{{ pay.state.gatewayNote }}</p>
    </section>

    <!-- Тарифы -->
    <section class="rounded-3xl border border-stone-200 bg-white p-4 shadow-soft sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex flex-wrap items-center gap-2">
        <p class="min-w-0 flex-1 basis-48 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
          Нажмите на тариф, чтобы увидеть, что в него входит. Пустое поле — вернётся стандартная цена из настроек.
          Цена одна для всех стран, оплата — картой, Apple и Google Pay.
        </p>
        <div class="flex shrink-0 items-center gap-1.5">
          <Button
            label="Сохранить всё"
            icon="pi pi-check"
            rounded
            size="small"
            :loading="pay.state.savingPrices"
            :disabled="pay.state.loading"
            @click="saveAllPlans()"
          />
        </div>
      </div>

      <div class="mt-4 space-y-2.5">
        <article
          v-for="plan in pay.state.plans"
          :key="plan.id"
          class="overflow-hidden rounded-2xl border border-stone-200/70 dark:border-zinc-800"
        >
          <!-- Шапка тарифа: клик раскрывает возможности -->
          <button
            type="button"
            class="flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-stone-50 sm:px-4 dark:hover:bg-zinc-800/50"
            :aria-expanded="pay.isExpanded(plan.id)"
            @click="pay.togglePlan(plan.id)"
          >
            <i
              class="pi pi-chevron-down shrink-0 text-xs text-stone-400 transition-transform dark:text-zinc-500"
              :class="pay.isExpanded(plan.id) ? '' : '-rotate-90'"
            />
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="text-sm font-black capitalize text-stone-900 dark:text-white">{{ plan.name }}</span>
                <Tag :value="PLAN_AUDIENCE_LABELS[plan.audience] ?? plan.audience" severity="secondary" class="!text-[11px]" />
                <Tag :value="`${pay.featureCount(plan.id)} возм.`" severity="info" class="!text-[11px]" />
              </span>
              <span v-if="plan.tagline" class="mt-0.5 block truncate text-xs text-stone-500 dark:text-zinc-400">{{ plan.tagline }}</span>
            </span>
            <span class="shrink-0 text-right text-sm font-black text-emerald-600 dark:text-emerald-400">{{ planMonthlyLabel(plan) }}</span>
          </button>

          <div class="border-t border-stone-100 px-3 py-3 sm:px-4 dark:border-zinc-800">
            <!-- Название и описание -->
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Название</span>
                <InputText v-model="plan.name" class="w-full" maxlength="60" />
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Коротко о тарифе</span>
                <InputText v-model="plan.tagline" class="w-full" maxlength="200" placeholder="Например: для активных знакомств" />
              </label>
            </div>
            <!-- Цены -->
            <div class="mt-2.5 grid grid-cols-2 gap-2 lg:grid-cols-3">
              <label v-for="col in priceColumns" :key="col.key" class="block">
                <span class="mb-1 block text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">{{ col.label }}</span>
                <InputNumber
                  v-model="plan.prices[col.key]"
                  mode="currency"
                  currency="USD"
                  locale="en-US"
                  :min-fraction-digits="2"
                  placeholder="Бесплатно"
                  class="w-full"
                  input-class="w-full"
                />
                <span class="mt-0.5 block text-[11px] leading-snug text-stone-400 dark:text-zinc-500">{{ col.hint }}</span>
              </label>
            </div>
            <p v-if="plan.id === 'free'" class="mt-1.5 text-[11px] leading-relaxed text-stone-400 dark:text-zinc-500">
              Бесплатный тариф: все цены пустые, отдельно платить не нужно.
            </p>

            <!-- Вложенные возможности -->
            <div v-if="pay.isExpanded(plan.id)" class="mt-3 rounded-2xl bg-stone-50 p-2.5 sm:p-3 dark:bg-zinc-800/60">
              <div class="flex flex-wrap items-center gap-2 px-1 pb-2">
                <p class="min-w-0 flex-1 basis-40 text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-zinc-500">
                  Что входит в «{{ plan.name }}»
                </p>
                <Button label="Добавить" icon="pi pi-plus" rounded size="small" @click="pay.openCreateForPlan(plan.id)" />
              </div>

              <p v-if="pay.featureCount(plan.id) === 0" class="rounded-xl bg-white px-3 py-4 text-center text-xs text-stone-500 sm:text-sm dark:bg-zinc-900 dark:text-zinc-400">
                Пока пусто — добавьте первую возможность кнопкой «Добавить».
              </p>

              <ul v-else class="space-y-1.5">
                <li
                  v-for="feat in pay.featuresByPlan.value[plan.id]"
                  :key="feat.id"
                  class="flex items-center gap-2 rounded-xl border border-stone-200/60 bg-white px-2.5 py-2 dark:border-zinc-700/60 dark:bg-zinc-900"
                >
                  <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <i class="pi pi-check text-xs" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-bold text-stone-800 dark:text-zinc-100">{{ feat.name }}</span>
                    <span v-if="feat.description" class="block truncate text-xs text-stone-500 dark:text-zinc-400">{{ feat.description }}</span>
                    <span v-else class="block text-xs text-stone-400 dark:text-zinc-500">Без пояснения</span>
                  </span>
                  <Tag :value="feat.is_active ? 'Видна' : 'Скрыта'" :severity="feat.is_active ? 'success' : 'secondary'" class="!text-[11px] hidden shrink-0 sm:inline-flex" />
                  <span class="flex shrink-0 items-center">
                    <Button
                      icon="pi pi-pencil"
                      rounded
                      text
                      size="small"
                      aria-label="Изменить"
                      @click="pay.openEdit(feat)"
                    />
                    <Button
                      icon="pi pi-trash"
                      rounded
                      text
                      severity="danger"
                      size="small"
                      aria-label="Удалить"
                      @click="pay.removeItem(feat)"
                    />
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Витрина -->
    <section class="rounded-3xl border border-stone-200 bg-white p-4 shadow-soft sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div class="flex flex-wrap items-center gap-2">
        <div class="min-w-0 flex-1 basis-48">
          <h2 class="text-base font-black text-stone-900 dark:text-white">Витрина: кредиты и реклама</h2>
          <p class="mt-0.5 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
            Разовые товары. Выключенное не продаётся: включится — появится у людей в приложении.
          </p>
        </div>
        <Select
          v-model="pay.moduleFilter.value"
          :options="moduleOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="max-w-[160px]"
          aria-label="Показать раздел"
        />
        <Button label="Добавить" icon="pi pi-plus" rounded size="small" class="shrink-0" @click="pay.openCreate()" />
      </div>

      <!-- Десктоп: таблица -->
      <DataTable
        :value="pay.visibleItems.value"
        size="small"
        striped-rows
        class="mt-3 hidden sm:block"
      >
        <Column header="Товар">
          <template #body="{ data }">
            <div class="text-sm font-bold text-stone-800 dark:text-zinc-100">{{ data.name }}</div>
            <div class="mt-0.5 flex flex-wrap gap-1">
              <Tag :value="PAYMENT_MODULE_LABELS[data.module] ?? data.module" severity="secondary" class="!text-[11px]" />
              <Tag :value="PAYMENT_KIND_LABELS[data.kind] ?? data.kind" :severity="kindSeverity(data.kind)" class="!text-[11px]" />
            </div>
            <div class="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">{{ data.description || 'Без пояснения' }}</div>
          </template>
        </Column>
        <Column header="Цена" class="w-28">
          <template #body="{ data }">
            <span class="text-sm font-black text-stone-900 dark:text-white">{{ priceLabelOf(data) }}</span>
          </template>
        </Column>
        <Column header="В продаже" class="w-24">
          <template #body="{ data }">
            <ToggleSwitch :model-value="data.is_active" :aria-label="data.name" @update:model-value="pay.toggleActive(data)" />
          </template>
        </Column>
        <Column header="" class="w-24">
          <template #body="{ data }">
            <div class="flex gap-1">
              <Button icon="pi pi-pencil" rounded text size="small" aria-label="Изменить" @click="pay.openEdit(data)" />
              <Button icon="pi pi-trash" rounded text severity="danger" size="small" aria-label="Удалить" @click="pay.removeItem(data)" />
            </div>
          </template>
        </Column>
        <template #empty>
          <p class="py-6 text-center text-sm text-stone-500 dark:text-zinc-400">Пока пусто — добавьте первый товар кнопкой «Добавить».</p>
        </template>
      </DataTable>

      <!-- Мобилка: карточки -->
      <ul class="mt-3 space-y-2 sm:hidden">
        <li
          v-for="item in pay.visibleItems.value"
          :key="item.id"
          class="rounded-2xl border border-stone-200/70 px-3 py-2.5 dark:border-zinc-800"
        >
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold text-stone-800 dark:text-zinc-100">{{ item.name }}</p>
              <p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">{{ item.description || 'Без пояснения' }}</p>
              <div class="mt-1.5 flex flex-wrap gap-1">
                <Tag :value="PAYMENT_MODULE_LABELS[item.module] ?? item.module" severity="secondary" class="!text-[11px]" />
                <Tag :value="PAYMENT_KIND_LABELS[item.kind] ?? item.kind" :severity="kindSeverity(item.kind)" class="!text-[11px]" />
              </div>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-1.5">
              <span class="text-sm font-black text-stone-900 dark:text-white">{{ priceLabelOf(item) }}</span>
              <ToggleSwitch :model-value="item.is_active" :aria-label="item.name" @update:model-value="pay.toggleActive(item)" />
            </div>
          </div>
          <div class="mt-1.5 flex justify-end gap-1 border-t border-stone-100 pt-1.5 dark:border-zinc-800">
            <Button icon="pi pi-pencil" rounded text size="small" aria-label="Изменить" @click="pay.openEdit(item)" />
            <Button icon="pi pi-trash" rounded text severity="danger" size="small" aria-label="Удалить" @click="pay.removeItem(item)" />
          </div>
        </li>
      </ul>
      <p v-if="pay.visibleItems.value.length === 0" class="py-6 text-center text-sm text-stone-500 sm:hidden dark:text-zinc-400">
        Пока пусто — добавьте первый товар кнопкой «Добавить».
      </p>

      <Message v-if="pay.state.notice" severity="success" :closable="false" class="mt-3">{{ pay.state.notice }}</Message>
      <Message v-if="pay.state.error" severity="error" :closable="false" class="mt-3">{{ pay.state.error }}</Message>
    </section>

    <!-- Помощь: как работать -->
    <Dialog
      v-model:visible="pay.state.helpOpen"
      modal
      dismissableMask
      :draggable="false"
      header="Как работать с тарифами"
      :style="{ width: '520px', maxWidth: '94vw' }"
      :pt="{ root: { class: '!rounded-[28px] !border-0 overflow-hidden' } }"
    >
      <ol class="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-stone-600 dark:text-zinc-300">
        <li><b class="text-stone-900 dark:text-white">Цены.</b> Впишите новую цену и нажмите «Сохранить всё». Сотрите цену — вернётся стандартная из настроек. Цена одна для всех стран. Всё обновится в приложении и в боте само.</li>
        <li><b class="text-stone-900 dark:text-white">Названия и описания.</b> Меняются прямо в карточке тарифа и тоже сохраняются кнопкой «Сохранить всё».</li>
        <li><b class="text-stone-900 dark:text-white">Что входит в тариф.</b> Нажмите на тариф — раскроется список возможностей. Кнопка «Добавить» — новая строка, карандаш — изменить, корзина — убрать.</li>
        <li><b class="text-stone-900 dark:text-white">Витрина ниже.</b> Разовые товары: кредиты и реклама. Переключатель «В продаже» показывает или прячет товар у людей.</li>
        <li><b class="text-stone-900 dark:text-white">Excel.</b> Зелёная кнопка скачивает всё в цветной файл с подсказками и списками, синяя — загружает обратно. Удалили всё? Загрузите файл с галочкой «Очистить» — тарифы, цены, фишки и товары восстановятся.</li>
        <li><b class="text-stone-900 dark:text-white">Оплата.</b> Пока деньги принимают вручную через поддержку. Когда подключится оплата картой, эти же цены заработают автоматически.</li>
      </ol>
      <template #footer>
        <div class="flex justify-end">
          <Button label="Понятно" rounded autofocus @click="pay.state.helpOpen = false" />
        </div>
      </template>
    </Dialog>

    <!-- Диалог загрузки Excel -->
    <Dialog
      v-model:visible="pay.state.importOpen"
      modal
      dismissableMask
      :draggable="false"
      header="Загрузить Excel обратно"
      :style="{ width: '520px', maxWidth: '94vw' }"
      :pt="{ root: { class: '!rounded-[28px] !border-0 overflow-hidden' } }"
    >
      <div class="space-y-3">
        <p class="text-sm leading-relaxed text-stone-600 dark:text-zinc-300">
          Выберите файл, скачанный кнопкой «Скачать». Строки обновятся по серым «Ключам», новое добавится.
          Если всё удаляли — поставьте галочку ниже, и файл восстановит тарифы, цены, фишки и товары.
        </p>
        <FileUpload
          mode="basic"
          accept=".xlsx,.xls,.csv"
          :auto="false"
          choose-label="Выбрать файл"
          :disabled="pay.state.importing"
          @select="pay.handleImportPicked($event)"
        />
        <p v-if="pay.state.importFileName" class="text-xs text-stone-500 dark:text-zinc-400">
          Файл: {{ pay.state.importFileName }}
        </p>
        <label class="flex cursor-pointer items-start gap-2 rounded-2xl border border-stone-200 px-3 py-2.5 dark:border-zinc-700">
          <Checkbox v-model="pay.state.replaceOnImport" binary />
          <span>
            <span class="block text-sm font-bold text-stone-800 dark:text-zinc-100">Очистить всё перед загрузкой</span>
            <span class="block text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
              Удалить тарифы, фишки и товары, затем загрузить только из файла. Нужно для полного восстановления.
            </span>
          </span>
        </label>
        <Message v-if="pay.state.importResult" severity="success" :closable="false">
          Тарифы: {{ pay.state.importResult.plans_updated }}, фишки: {{ pay.state.importResult.features_saved }},
          товары: {{ pay.state.importResult.items_saved
          }}<span v-if="pay.state.importResult.deleted > 0">, очищено: {{ pay.state.importResult.deleted }}</span>.
        </Message>
        <Message
          v-if="pay.state.importResult && pay.state.importResult.warnings.length > 0"
          severity="warn"
          :closable="false"
        >
          <ul class="list-disc pl-4">
            <li v-for="(warn, i) in pay.state.importResult.warnings.slice(0, 5)" :key="i">{{ warn }}</li>
          </ul>
        </Message>
        <Message
          v-if="pay.state.importResult && pay.state.importResult.errors.length > 0"
          severity="error"
          :closable="false"
        >
          <ul class="list-disc pl-4">
            <li v-for="(err, i) in pay.state.importResult.errors.slice(0, 8)" :key="i">{{ err }}</li>
          </ul>
        </Message>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Закрыть" text rounded @click="pay.state.importOpen = false" />
        </div>
      </template>
    </Dialog>

    <!-- Диалог товара / возможности -->
    <Dialog
      v-model:visible="pay.state.dialogOpen"
      modal
      dismissableMask
      :draggable="false"
      :header="dialogTitle()"
      :style="{ width: '520px', maxWidth: '94vw' }"
      :pt="{ root: { class: '!rounded-[28px] !border-0 overflow-hidden' } }"
    >
      <div class="space-y-3">
        <template v-if="pay.state.draft.kind === 'feature'">
          <label class="block">
            <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">В какой тариф положить</span>
            <Select
              v-model="pay.state.draft.plan"
              :options="pay.state.plans.map((p) => ({ value: p.id, label: p.name }))"
              option-label="label"
              option-value="value"
              class="w-full"
            />
            <span class="mt-1 block text-xs text-stone-500 dark:text-zinc-400">Появится внутри карточки этого тарифа. Отдельно не продаётся.</span>
            <Button label="Сделать обычным товаром витрины" link size="small" class="!px-0 !text-xs" @click="pay.state.draft.kind = 'credit_pack'" />
          </label>
        </template>
        <template v-else>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">Где люди это увидят</span>
              <Select v-model="pay.state.draft.module" :options="moduleChoices" option-label="label" option-value="value" class="w-full" />
              <span class="mt-1 block text-xs text-stone-500 dark:text-zinc-400">{{ PAYMENT_MODULE_HINTS[pay.state.draft.module] }}</span>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">Что это такое</span>
              <Select v-model="pay.state.draft.kind" :options="kindChoices" option-label="label" option-value="value" class="w-full" />
              <span class="mt-1 block text-xs text-stone-500 dark:text-zinc-400">{{ PAYMENT_KIND_HINTS[pay.state.draft.kind] }}</span>
            </label>
          </div>
        </template>

        <label class="block">
          <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">Название</span>
          <InputText
            v-model="pay.state.draft.name"
            class="w-full"
            :placeholder="pay.state.draft.kind === 'feature' ? 'Например: Невидимка' : 'Например: 60 кредитов'"
          />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">Пояснение для людей</span>
          <Textarea
            v-model="pay.state.draft.description"
            rows="2"
            class="w-full"
            :placeholder="pay.state.draft.kind === 'feature' ? 'Что человек получит' : 'Сколько хватит и зачем'"
          />
        </label>

        <template v-if="pay.state.draft.kind !== 'feature'">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">Цена (пусто — бесплатно)</span>
              <InputNumber v-model="pay.state.draft.price" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="2" class="w-full" input-class="w-full" />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">Как часто платить</span>
              <Select v-model="pay.state.draft.period" :options="periodChoices" option-label="label" option-value="value" class="w-full" />
              <span class="mt-1 block text-xs text-stone-500 dark:text-zinc-400">{{ PAYMENT_PERIOD_HINTS[pay.state.draft.period] }}</span>
            </label>
          </div>

          <div class="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/60">
            <label class="flex cursor-pointer items-center gap-2">
              <ToggleSwitch v-model="pay.state.draft.showPricesByPlan" />
              <span class="text-sm font-bold text-stone-800 dark:text-zinc-100">Разные цены для тарифов</span>
            </label>
            <p class="mt-1 text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
              Например: для PRO дешевле, остальным — обычная цена. Пустое поле = обычная цена.
            </p>
            <p v-if="!pay.state.draft.showPricesByPlan" class="mt-1 text-xs font-semibold text-stone-500 dark:text-zinc-400">{{ ownPricesSummary() }}</p>
            <div v-if="pay.state.draft.showPricesByPlan" class="mt-2 grid grid-cols-2 gap-2">
              <label v-for="planId in (['free', 'pro', 'premium', 'business'] as const)" :key="planId" class="block rounded-xl bg-white px-2 py-2 dark:bg-zinc-900">
                <span class="mb-1 block text-xs font-bold text-stone-700 dark:text-zinc-200">Для «{{ planNameOf(planId) }}»</span>
                <InputNumber v-model="pay.state.draft.pricesByPlan[planId]" mode="currency" currency="USD" locale="en-US" :min-fraction-digits="2" placeholder="Как всем" class="w-full" input-class="w-full" />
              </label>
            </div>
          </div>
        </template>

        <label class="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-zinc-100">
          <ToggleSwitch v-model="pay.state.draft.is_active" />
          {{ pay.state.draft.kind === 'feature' ? 'Показывать в тарифе' : 'Продавать в витрине' }}
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
