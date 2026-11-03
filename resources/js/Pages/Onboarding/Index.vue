<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { h } from 'vue'
import GuestLayout from '@/Layouts/GuestLayout.vue'
import { useOnboardingForm } from '@/composables/useOnboardingForm'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Message from 'primevue/message'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ProgressSpinner from 'primevue/progressspinner'

defineOptions({
  layout: (createElement: typeof h, child: unknown) => createElement(GuestLayout, () => child),
})

useSeo({ title: 'Анкета — ULove', description: 'Заполни анкету: имя, пол, возраст, цель и город.', noindex: true })

/**
 * Страница-гейт Mini App: без заполненной анкеты дальше не пускаем.
 * Вся логика — в useOnboardingForm (Правило №1), здесь только форма.
 * Гостевая оболочка (GuestLayout): лёгкая, без API-вызовов, которые
 * гейт всё равно режет 403.
 */
const f = useOnboardingForm()
</script>

<template>
  <Head title="Заполни анкету" />
  <div class="mx-auto w-full max-w-[560px] px-4 py-10 sm:py-14">
    <Card :pt="{ root: { class: '!rounded-[28px] !border-0 shadow-xl dark:!bg-[#0F121F]' }, body: { class: '!p-6 sm:!p-8' } }">
      <template #content>
        <div class="flex flex-col items-center text-center">
          <span class="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white shadow-lg shadow-rose-500/30"><i class="pi pi-user-edit text-2xl leading-none" /></span>
          <h1 class="mt-4 text-[24px] font-black tracking-tight text-ink-900 dark:text-white">Почти готово! 📝</h1>
        </div>

        <div v-if="f.loading.value" class="mt-8 flex items-center justify-center gap-3 py-8">
          <ProgressSpinner style="width: 32px; height: 32px" :strokeWidth="5" aria-label="Загрузка анкеты" />
          <span class="text-sm font-medium text-stone-500 dark:text-zinc-400">Подтягиваем профиль…</span>
        </div>

        <Message v-else-if="f.loadError.value" severity="error" :closable="false" class="mt-6 !rounded-2xl">
          <span class="block">{{ f.loadError.value }}</span>
          <Button type="button" label="Попробовать снова" size="small" class="mt-2" @click="f.loadDraft()" />
        </Message>

        <form v-else class="mt-6 space-y-4" @submit.prevent="f.submit">
          <div>
            <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Имя *</label>
            <InputText v-model="f.name.value" v-bind="f.nameAttrs" placeholder="Как тебя зовут?" autocomplete="name" class="mt-1.5 w-full !rounded-2xl" :invalid="!!f.errors.value.name" />
            <small class="auth-err">{{ f.errors.value.name }}</small>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="min-w-0">
              <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Пол *</label>
              <Select v-model="f.gender.value" :options="f.genderOptions.value" optionLabel="label" optionValue="value" placeholder="Выбери пол" checkmark fluid class="mt-1.5 w-full !rounded-2xl" :invalid="!!f.errors.value.gender" />
              <small class="auth-err">{{ f.errors.value.gender }}</small>
            </div>
            <div class="min-w-0">
              <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Дата рождения *</label>
              <DatePicker v-model="f.birth_date.value" dateFormat="dd.mm.yy" placeholder="12.07.1997" :maxDate="new Date()" showIcon fluid class="mt-1.5 w-full !rounded-2xl" :invalid="!!f.errors.value.birth_date" />
              <small class="auth-err">{{ f.errors.value.birth_date }}</small>
            </div>
          </div>

          <div>
            <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Зачем ты здесь? *</label>
            <Select v-model="f.dating_goal.value" :options="f.goalOptions.value" optionLabel="label" optionValue="value" placeholder="Выбери цель" checkmark fluid class="mt-1.5 w-full !rounded-2xl" :invalid="!!f.errors.value.dating_goal" />
            <small class="auth-err">{{ f.errors.value.dating_goal }}</small>
          </div>

          <div>
            <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Город <span class="font-normal text-stone-400 dark:text-zinc-500">(необязательно)</span></label>
            <InputText v-model="f.home_city.value" v-bind="f.homeCityAttrs" placeholder="Минск" autocomplete="address-level2" class="mt-1.5 w-full !rounded-2xl" :invalid="!!f.errors.value.home_city" />
            <small class="auth-err">{{ f.errors.value.home_city }}</small>
          </div>

          <Button :loading="f.isSubmitting.value" type="submit" label="Готово — показать свайпы →" class="w-full !border-0 !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !py-3.5 !font-bold !text-white !rounded-full shadow-lg shadow-rose-500/30" />
          <p class="text-center text-xs leading-relaxed text-stone-400 dark:text-zinc-500">Свайпы — строго с 18 лет. Город поможет подобрать людей рядом.</p>
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.auth-err {
  color: #ef4444;
  display: block;
  min-height: 0;
}
:global(html.dark) .auth-err {
  color: #f87171;
}
</style>
