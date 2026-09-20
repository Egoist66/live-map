<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { useRegisterForm } from '@/composables/useAuthForm'
import { useSignupGoals } from '@/composables/useSignupGoals'
import { useBirthDateField } from '@/composables/useBirthDate'
import { useGender } from '@/composables/useGender'
import { useUserAge } from '@/composables/useUserAge'
import { RESIDENCE_COUNTRIES } from '@/composables/useResidence'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'

const f = useRegisterForm()
const goals = useSignupGoals()
const bd = useBirthDateField(f.birth_date as any)
const g = useGender()
const { label: ageLabel } = useUserAge(() => (f.values as any).birth_date)

function onCountryChange(v: string): void {
  const found = [...RESIDENCE_COUNTRIES].find((x) => x.name === v)
  const prevCode = (f.values as any).country_code
  f.setValues({ country: v, country_code: found ? found.code : prevCode } as any)
}
</script>

<template>
  <Head title="Регистрация" />
    <h1 class="text-[22px] font-black tracking-tight text-ink-900 dark:text-white">Создай аккаунт</h1>
    <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">💘 ULove знакомит рядом · 📍 пины показывают жизнь района</p>
    <form @submit.prevent="f.submit" class="mt-6 space-y-4">
      <div v-if="!f.goalPreset.locked" class="rounded-2xl border-2 border-rose-200 dark:border-rose-900 bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/20 p-3.5">
        <label class="auth-label">💘 Зачем ты здесь? *</label>
        <Select v-model="f.signup_goal.value" :options="goals.preset.options" optionLabel="label" optionValue="value" placeholder="Выбери цель" checkmark fluid class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.signup_goal" />
        <small class="auth-err">{{ f.errors.value.signup_goal }}</small>
        <small class="text-stone-500 dark:text-zinc-400">После регистрации откроем ULove — листай людей рядом 💘</small>
      </div>
      <div v-else class="rounded-2xl border-2 border-sky-200 dark:border-sky-900 bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/20 p-3.5 flex items-center gap-3">
        <span class="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-lg shrink-0">📍</span>
        <div class="text-[13px] leading-snug text-stone-600 dark:text-zinc-300"><span class="font-bold text-ink-900 dark:text-white">Ты с UPin</span> — после регистрации откроем карту: кидай пины, зови рядом 📍</div>
      </div>
      <div>
        <label class="auth-label">Имя / ник</label>
        <InputText v-model="f.name.value" v-bind="f.nameAttrs" placeholder="Роберт Дауни" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.name" />
        <small class="auth-err">{{ f.errors.value.name }}</small>
      </div>
      <div>
        <label class="auth-label">Email</label>
        <InputText v-model="f.email.value" v-bind="f.emailAttrs" type="email" placeholder="you@mail.ru" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.email" />
        <small class="auth-err">{{ f.errors.value.email }}</small>
      </div>
      <div>
        <label class="auth-label">Пол *</label>
        <Select v-model="f.gender.value" :options="g.options" optionLabel="label" optionValue="value" placeholder="Выбери пол" checkmark fluid class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.gender" />
        <small class="auth-err">{{ f.errors.value.gender }}</small>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="min-w-0">
          <label class="auth-label">Дата рождения</label>
          <DatePicker v-model="bd.birthDateInput.value" v-bind="bd.birthDatePickerProps.value" placeholder="12.07.1997" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.birth_date" />
          <small class="auth-err">{{ f.errors.value.birth_date }}</small>
          <small v-if="ageLabel" class="text-stone-500 dark:text-zinc-400">{{ ageLabel }}</small>
        </div>
        <div class="min-w-0">
          <label class="auth-label">Город проживания</label>
          <InputText v-model="f.home_city.value" placeholder="Минск" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.home_city" />
          <small class="auth-err">{{ f.errors.value.home_city }}</small>
        </div>
      </div>
      <div>
        <label class="auth-label">Страна проживания</label>
        <Select v-model="f.country.value" :options="[...RESIDENCE_COUNTRIES]" optionLabel="name" optionValue="name" placeholder="Беларусь" checkmark editable fluid class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.country" @update:model-value="onCountryChange" />
        <small class="text-stone-500 dark:text-zinc-400">Пины можно создавать только в своей стране</small>
        <small v-if="f.countryWarning.value" class="block text-amber-600 dark:text-amber-400">⚠️ {{ f.countryWarning.value }}</small>
        <small class="auth-err">{{ f.errors.value.country }}</small>
      </div>
      <div>
        <label class="auth-label">Пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="f.password.value" v-bind="f.passwordAttrs" :type="f.showPass.value ? 'text' : 'password'" placeholder="••••••••" class="w-full auth-input !pr-11" :invalid="!!f.errors.value.password" />
          <button type="button" @click="f.showPass.value = !f.showPass.value" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1">{{ f.showPass.value ? '🙈' : '👁' }}</button>
        </div>
        <small class="auth-err">{{ f.errors.value.password }}</small>
      </div>
      <div>
        <label class="auth-label">Подтверди пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="f.password_confirmation.value" v-bind="f.passwordConfirmationAttrs" :type="f.showPass2.value ? 'text' : 'password'" placeholder="••••••••" class="w-full auth-input !pr-11" :invalid="!!f.errors.value.password_confirmation" />
          <button type="button" @click="f.showPass2.value = !f.showPass2.value" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1">{{ f.showPass2.value ? '🙈' : '👁' }}</button>
        </div>
        <small class="auth-err">{{ f.errors.value.password_confirmation }}</small>
      </div>
      <div class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 p-3.5 space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <span class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Моё место на карте</span>
          <span class="text-[11px] font-bold text-stone-500 dark:text-zinc-400">необязательно</span>
        </div>
        <p class="text-[11px] leading-relaxed text-stone-500 dark:text-zinc-400">Нажми — карта и твоя точка настроится сразу. Пропустишь — откроем страну и город из профиля, а точную точку покажешь позже кнопкой геолокации на карте.</p>
        <Button type="button" :loading="f.locating.value" severity="secondary" outlined rounded class="w-full" :label="f.values.home_lat ? 'Обновить моё место' : 'Определить моё место'" icon="pi pi-map-marker" @click="f.detectLocation" />
        <div v-if="f.values.home_address || f.addrLoading.value" class="rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 flex items-center gap-2">
          <span class="w-7 h-7 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center shrink-0 text-[11px]">◉</span>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold truncate dark:text-zinc-100">{{ f.addrLoading.value ? 'Определяем район…' : f.values.home_address }}</div>
            <div v-if="f.values.home_lat" class="text-[11px] text-stone-400 dark:text-zinc-400 font-mono">{{ f.values.home_lat }}, {{ f.values.home_lng }}</div>
          </div>
          <button v-if="f.values.home_lat && !f.addrLoading.value" type="button" class="shrink-0 w-7 h-7 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-400 dark:text-zinc-400" title="Убрать точку" @click="f.clearLocation"><i class="pi pi-times text-[11px]"></i></button>
        </div>
      </div>
      <Button :loading="f.isSubmitting.value" type="submit" label="Создать аккаунт →" class="w-full !bg-ink-900 dark:!bg-[#FAFAFA] !border-ink-900 dark:!border-[#FAFAFA] !text-white dark:!text-[#0F172A] !rounded-full !py-3.5 [&_.p-button-label]:!text-white dark:[&_.p-button-label]:!text-[#0F172A]" />
      <div class="text-sm text-center text-stone-500 dark:text-zinc-400">Уже есть? <Link :href="route('login')" class="font-semibold text-ink-900 dark:text-white hover:underline">Войти</Link></div>
    </form>
</template>

<style scoped>
.auth-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}
:global(html.dark) .auth-label {
  color: #f4f4f5;
}
.auth-err {
  color: #ef4444;
  display: block;
  min-height: 0;
}
:global(html.dark) .auth-err {
  color: #f87171;
}
.auth-input {
  border-radius: 16px;
}
.auth-input:deep(.p-inputtext),
.auth-input:deep(.p-select-label),
.auth-input:deep(.p-datepicker-input),
.auth-input:deep(input) {
  border-radius: 16px;
}
.auth-input:deep(.p-select),
.auth-input:deep(.p-datepicker) {
  border-radius: 16px;
}
</style>
