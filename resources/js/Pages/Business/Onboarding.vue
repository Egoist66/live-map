<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { h } from 'vue'
import BusinessLayout from '@/Layouts/BusinessLayout.vue'
import { useBusinessOnboarding } from '@/composables/useBusinessOnboarding'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Steps from 'primevue/steps'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(BusinessLayout, () => child),
})

useSeo({ title: 'Регистрация компании — UPin', description: 'Онбординг бизнеса по законодательству РБ.', noindex: true })

const ob = useBusinessOnboarding()
const stepItems = [{ label: 'Компания' }, { label: 'Реквизиты РБ' }, { label: 'Точка и контакты' }]
</script>

<template>
  <Head title="Регистрация компании" />
  <div class="max-w-[760px] mx-auto space-y-4">
    <div>
      <h1 class="text-[22px] sm:text-[26px] font-black tracking-tight dark:text-white">Регистрация компании</h1>
      <p class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1">По законодательству РБ: форма, УНП из 9 цифр и юридический адрес. Проверка — обычно в течение дня.</p>
    </div>

    <Steps :model="stepItems" :active-step="ob.step.value" class="w-full" />

    <Message v-if="ob.loaded.value && ob.isComplete.value" severity="success" class="w-full">
      Все обязательные реквизиты уже заполнены — проверьте данные ниже и отправьте заявку.
    </Message>
    <Message v-else-if="ob.loaded.value && ob.missing.value.length" severity="info" class="w-full">
      <span class="font-semibold">Осталось дозаполнить:</span>
      <span class="inline-flex flex-wrap gap-1.5 ml-1">
        <button
          v-for="field in ob.missing.value"
          :key="field.key"
          type="button"
          class="underline font-semibold hover:opacity-80"
          @click="ob.goToMissing(field)"
        >{{ field.label }}</button>
      </span>
    </Message>

    <Card class="!rounded-[24px] !border-stone-200 dark:!border-zinc-800 !bg-white dark:!bg-zinc-900 !shadow-sm">
      <template #content>
        <form @submit.prevent="ob.finish" class="space-y-4">
          <template v-if="ob.step.value === 0">
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">Название компании *</label>
              <InputText v-model="ob.name.value" v-bind="ob.nameAttrs" placeholder="ООО «Кофейня у парка»" class="w-full mt-1.5 !rounded-2xl" :invalid="!!ob.errors.value.name" />
              <small class="text-red-500">{{ ob.errors.value.name }}</small>
            </div>
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">Бренд</label>
              <InputText v-model="ob.brand.value" placeholder="Как клиенты ищут вас на карте" class="w-full mt-1.5 !rounded-2xl" />
              <p class="text-[12px] text-stone-500 dark:text-zinc-400 mt-1">Витринное название для поиска — юрназвание часто канцелярское, а бренд помнят.</p>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[13px] font-semibold dark:text-zinc-100">Форма собственности *</label>
                <Select v-model="ob.legalForm.value" :options="ob.legalFormOptions" option-label="label" option-value="value" fluid class="w-full mt-1.5 !rounded-2xl" />
              </div>
              <div>
                <label class="text-[13px] font-semibold dark:text-zinc-100">Категория</label>
                <InputText v-model="ob.category.value" placeholder="Кофейня, автосервис…" class="w-full mt-1.5 !rounded-2xl" />
              </div>
            </div>
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">О компании</label>
              <Textarea v-model="ob.description.value" rows="3" auto-resize placeholder="Чем полезны соседям?" class="w-full mt-1.5 !rounded-2xl" />
            </div>
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">Услуги</label>
              <Textarea v-model="ob.services.value" rows="3" auto-resize placeholder="Стрижка, кофе с собой, ремонт…" class="w-full mt-1.5 !rounded-2xl" />
            </div>
          </template>

          <template v-else-if="ob.step.value === 1">
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[13px] font-semibold dark:text-zinc-100">УНП (9 цифр) *</label>
                <InputText v-model="ob.unp.value" v-bind="ob.unpAttrs" inputmode="numeric" placeholder="123456789" class="w-full mt-1.5 !rounded-2xl font-mono" :invalid="!!ob.errors.value.unp" />
                <small class="text-red-500">{{ ob.errors.value.unp }}</small>
              </div>
              <div>
                <label class="text-[13px] font-semibold dark:text-zinc-100">Номер госрегистрации</label>
                <InputText v-model="ob.regNumber.value" placeholder="№ свидетельства" class="w-full mt-1.5 !rounded-2xl" />
              </div>
            </div>
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">Юридический адрес *</label>
              <InputText v-model="ob.legalAddress.value" v-bind="ob.legalAddressAttrs" placeholder="г. Минск, ул. …" class="w-full mt-1.5 !rounded-2xl" :invalid="!!ob.errors.value.legal_address" />
              <small class="text-red-500">{{ ob.errors.value.legal_address }}</small>
            </div>
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">Руководитель / ИП</label>
              <InputText v-model="ob.directorName.value" placeholder="Иванов Иван Иванович" class="w-full mt-1.5 !rounded-2xl" />
            </div>
          </template>

          <template v-else>
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">Фактический адрес / точка</label>
              <InputText v-model="ob.address.value" placeholder="г. Минск, ул. Ленина, 1" class="w-full mt-1.5 !rounded-2xl" @blur="ob.maybeDetectCoords()" />
              <div class="mt-2 flex flex-wrap gap-2">
                <Button label="Найти на карте" icon="pi pi-map-marker" size="small" rounded :loading="ob.geocoding.value" class="!bg-indigo-600 !border-indigo-600 hover:!bg-indigo-500" @click="ob.detectCoords()" type="button" />
                <Button v-if="String(ob.values.legal_address ?? '').trim() !== ''" label="Как юр. адрес" icon="pi pi-id-card" size="small" rounded outlined @click="ob.useLegalAddressAsPoint()" type="button" />
              </div>
              <p class="mt-2 text-[12px] font-semibold" :class="String(ob.values.lat ?? '') !== '' && String(ob.values.lng ?? '') !== '' ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-zinc-400'">{{ ob.coordsLabel.value }}</p>
              <p class="text-[12px] text-stone-500 dark:text-zinc-400">Широту и долготу вводить не нужно — считаем сами по адресу, точка пригодится карте и поиску.</p>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[13px] font-semibold dark:text-zinc-100">Телефон</label>
                <InputText v-model="ob.phone.value" placeholder="+375 …" class="w-full mt-1.5 !rounded-2xl" />
              </div>
              <div>
                <label class="text-[13px] font-semibold dark:text-zinc-100">Сайт</label>
                <InputText v-model="ob.website.value" placeholder="https://…" class="w-full mt-1.5 !rounded-2xl" />
              </div>
            </div>
            <div>
              <label class="text-[13px] font-semibold dark:text-zinc-100">Часы работы</label>
              <p class="text-[12px] text-stone-500 dark:text-zinc-400 mt-0.5">Пустой день — выходной. Видят клиенты в профиле компании.</p>
              <div class="mt-2 space-y-1.5">
                <div v-for="day in ob.weekDays" :key="day.key" class="flex items-center gap-2.5">
                  <span class="w-8 shrink-0 text-[13px] font-bold text-stone-500 dark:text-zinc-400">{{ day.label }}</span>
                  <InputText v-model="ob.hours.value[day.key]" placeholder="9:00–21:00" class="flex-1 !rounded-2xl" />
                </div>
              </div>
            </div>
          </template>

          <div class="flex gap-2 pt-1">
            <Button v-if="ob.step.value > 0" label="Назад" severity="secondary" outlined rounded class="flex-1" @click="ob.back()" type="button" />
            <Button v-if="ob.step.value < 2" label="Дальше" rounded class="flex-1 !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !border-0" :disabled="!ob.stepValid.value" @click="ob.next()" type="button" />
            <Button v-else label="Отправить на проверку" icon="pi pi-check" rounded class="flex-1 !bg-gradient-to-r !from-indigo-500 !to-violet-600 !text-white !border-0" :loading="ob.store.saving" type="submit" />
          </div>
          <p v-if="ob.store.error" class="text-[13px] text-red-500 text-center">{{ ob.store.error }}</p>
        </form>
      </template>
    </Card>
  </div>
</template>
