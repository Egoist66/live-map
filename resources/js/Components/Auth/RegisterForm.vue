<script setup lang="ts">
import { useRegisterForm } from '@/composables/useAuthForm'
import { useAuthTheme } from '@/composables/useAuthTheme'
import { useRegisterVisibility } from '@/composables/useRegisterVisibility'
import { useBirthDateField } from '@/composables/useBirthDate'
import { useGender } from '@/composables/useGender'
import { useUserAge } from '@/composables/useUserAge'
import { RESIDENCE_COUNTRIES } from '@/composables/useResidence'
import TurnstileWidget from '@/Components/Security/TurnstileWidget.vue'
import { useBotQr } from '@/composables/useBotQr'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'

/**
 * Форма регистрации ULove: всегда персона и всегда стиль ULove.
 * Бизнес-ветки больше нет — по вопросам сотрудничества
 * на стартовой странице есть CTA «Писать нам».
 *
 * Живёт внутри единой страницы Auth/Login, переключение
 * обратно на вход — через событие switch-login.
 */
const emit = defineEmits<{ (e: 'switch-login'): void }>()

const t = useAuthTheme()

/**
 * Вход через Telegram-бота внизу формы: тап открывает бота,
 * /start ведёт в Mini App, аккаунт создаётся сам (авторегистрация
 * по initData) — почту бот попросит позже, уже внутри.
 */
const bot = useBotQr()

const f = useRegisterForm()
const reg = useRegisterVisibility()
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
  <div>
    <div class="flex flex-col items-center text-center">
      <h1 class="text-[22px] font-black tracking-tight text-ink-900 dark:text-white leading-tight">{{ t.registerTitle.value }}</h1>
    </div>

    <div class="mt-5">
      <div class="flex items-center justify-between gap-3">
        <span aria-live="polite" class="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-zinc-500">Шаг {{ f.stepNumber.value }} из {{ f.totalSteps }}</span>
        <span class="text-[12px] font-semibold text-[#FF4267]">{{ f.currentStep.value.title }}</span>
      </div>
      <ProgressBar :value="f.progress.value" :show-value="false" class="reg-progress mt-2 !h-1.5" />
      <p class="mt-2 text-[12px] leading-relaxed text-stone-500 dark:text-zinc-400">{{ f.currentStep.value.hint }}</p>
    </div>

    <form class="mt-4" @submit.prevent="f.onSubmit">
      <Transition name="reg-step" mode="out-in">
        <div :key="f.currentStep.value.id" class="space-y-4">
          <template v-if="f.currentStep.value.id === 'about'">
            <div class="rounded-2xl border-2 border-[#FF4267]/25 bg-[#FF4267]/5 dark:border-[#FF4267]/25 dark:bg-[#FF4267]/10 p-3.5">
              <label class="auth-label">Зачем ты здесь? *</label>
              <Select v-model="f.signup_goal.value" :options="reg.goalOptions.value" optionLabel="label" optionValue="value" placeholder="Выбери цель" checkmark fluid class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.signup_goal" />
              <small class="auth-err">{{ f.errors.value.signup_goal }}</small>
            </div>
            <div class="min-w-0">
              <label class="auth-label">Имя / ник</label>
              <InputText v-model="f.name.value" v-bind="f.nameAttrs" placeholder="Роберт Дауни" autocomplete="nickname" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.name" />
              <small class="auth-err">{{ f.errors.value.name }}</small>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="min-w-0">
                <label class="auth-label">Пол *</label>
                <Select v-model="f.gender.value" :options="g.options" optionLabel="label" optionValue="value" placeholder="Выбери пол" checkmark fluid class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.gender" />
                <small class="auth-err">{{ f.errors.value.gender }}</small>
              </div>
              <div class="min-w-0">
                <label class="auth-label">Дата рождения</label>
                <DatePicker v-model="bd.birthDateInput.value" v-bind="bd.birthDatePickerProps.value" placeholder="12.07.1997" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.birth_date" />
                <small class="auth-err">{{ f.errors.value.birth_date }}</small>
                <small v-if="ageLabel" class="text-stone-500 dark:text-zinc-400">{{ ageLabel }}</small>
              </div>
            </div>
          </template>

          <template v-else-if="f.currentStep.value.id === 'location'">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="min-w-0">
                <label class="auth-label">Страна проживания</label>
                <Select v-model="f.country.value" :options="[...RESIDENCE_COUNTRIES]" optionLabel="name" optionValue="name" placeholder="Беларусь" checkmark editable fluid class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.country" @update:model-value="onCountryChange" />
                <small v-if="f.countryWarning.value" class="block text-amber-600 dark:text-amber-400"><i class="pi pi-exclamation-triangle mr-1" />{{ f.countryWarning.value }}</small>
                <small class="auth-err">{{ f.errors.value.country }}</small>
              </div>
              <div class="min-w-0">
                <label class="auth-label">Город проживания</label>
                <InputText v-model="f.home_city.value" placeholder="Минск" autocomplete="address-level2" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.home_city" />
                <small class="auth-err">{{ f.errors.value.home_city }}</small>
              </div>
            </div>
            <div class="rounded-2xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/[0.06] p-3.5 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">{{ reg.locationTitle.value }}</span>
                <span class="text-[11px] font-bold text-stone-500 dark:text-zinc-400">необязательно</span>
              </div>
              <p class="text-[11px] leading-relaxed text-stone-500 dark:text-zinc-400">{{ reg.locationHint.value }}</p>
              <Button type="button" :loading="f.locating.value" severity="secondary" outlined rounded class="w-full" :label="f.values.home_lat ? 'Обновить моё место' : 'Определить моё место'" icon="pi pi-map-marker" @click="() => f.detectLocation()" />
              <Message v-if="f.locationError.value" severity="warn" :closable="false" class="!text-[11px]">{{ f.locationError.value }}</Message>
              <div v-if="f.values.home_address || f.addrLoading.value" class="rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] px-3 py-2.5 flex items-center gap-2">
                <span class="w-7 h-7 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center shrink-0 text-[11px]">◉</span>
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-semibold truncate dark:text-zinc-100">{{ f.addrLoading.value ? reg.addressLoadingText.value : f.values.home_address }}</div>
                </div>
                <button v-if="f.values.home_lat && !f.addrLoading.value" type="button" class="shrink-0 w-7 h-7 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-400 dark:text-zinc-400" title="Убрать точку" @click="f.clearLocation"><i class="pi pi-times text-[11px]"></i></button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="min-w-0">
              <label class="auth-label">Email</label>
              <InputText v-model="f.email.value" v-bind="f.emailAttrs" type="email" placeholder="you@mail.ru" autocomplete="email" class="w-full mt-1.5 auth-input" :invalid="!!f.errors.value.email" />
              <small class="auth-err">{{ f.errors.value.email }}</small>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="min-w-0">
                <label class="auth-label">Пароль</label>
                <div class="relative mt-1.5">
                  <InputText v-model="f.password.value" v-bind="f.passwordAttrs" :type="f.showPass.value ? 'text' : 'password'" placeholder="••••••••" autocomplete="new-password" class="w-full auth-input !pr-11" :invalid="!!f.errors.value.password" />
                  <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1" aria-label="Показать пароль" @click="f.showPass.value=!f.showPass.value"><i :class="f.showPass.value ? 'pi pi-eye-slash' : 'pi pi-eye'" /></button>
                </div>
                <small class="auth-err">{{ f.errors.value.password }}</small>
              </div>
              <div class="min-w-0">
                <label class="auth-label">Подтверди пароль</label>
                <div class="relative mt-1.5">
                  <InputText v-model="f.password_confirmation.value" v-bind="f.passwordConfirmationAttrs" :type="f.showPass2.value ? 'text' : 'password'" placeholder="••••••••" autocomplete="new-password" class="w-full auth-input !pr-11" :invalid="!!f.errors.value.password_confirmation" />
                  <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1" aria-label="Показать пароль" @click="f.showPass2.value=!f.showPass2.value"><i :class="f.showPass2.value ? 'pi pi-eye-slash' : 'pi pi-eye'" /></button>
                </div>
                <small class="auth-err">{{ f.errors.value.password_confirmation }}</small>
              </div>
            </div>
            <input v-model="f.trap.value.value" :name="f.trap.fieldName" type="text" :class="f.trap.hiddenClass" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <TurnstileWidget v-model:token="f.captchaToken.value" />
            <small v-if="f.errors.value.captcha_token" class="auth-err text-center">{{ f.errors.value.captcha_token }}</small>
          </template>
        </div>
      </Transition>

      <div class="mt-5 flex gap-2.5">
        <Button v-if="!f.isFirstStep.value" type="button" label="Назад" icon="pi pi-arrow-left" severity="secondary" outlined rounded class="!w-auto shrink-0 !px-4 !py-3 !font-semibold" @click="f.goBack" />
        <Button v-if="!f.isLastStep.value" type="button" label="Дальше" icon="pi pi-arrow-right" icon-pos="right" :class="['flex-1', t.submitClass.value]" @click="f.nextStep" />
        <Button v-else :loading="f.isSubmitting.value" type="submit" label="Создать анкету →" :class="['flex-1', t.submitClass.value]" />
      </div>

      <div class="mt-4 flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 text-[12px] font-semibold text-sky-700 transition hover:underline dark:text-sky-300"
          :title="`Открыть бота @${bot.botUsername.value}`"
          @click="bot.openBot()"
        >
          <i class="pi pi-telegram text-sm leading-none" />
          <span>Зайти через Telegram-бота</span>
        </button>
        <div class="text-[13px] text-stone-500 dark:text-zinc-400">Уже есть профиль? <button type="button" class="font-semibold text-ink-900 dark:text-white hover:underline" @click="emit('switch-login')">Войти</button></div>
      </div>
    </form>
  </div>
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
/* Инпуты: корень InputText и есть <input>, поэтому высоту
   и скругление задаём самому корню, а не потомкам —
   селектор `.auth-input .p-inputtext` сам себя не находит. */
input.p-inputtext.auth-input {
  border-radius: 16px;
  min-height: 48px;
  width: 100%;
  padding: 0.7rem 1rem;
}
/* Селекты: цельная пилюля — рамка и скругление только
   на корне (рамка живёт на корне), внутренности прозрачные
   без своих радиусов, иначе правый край с шевроном
   выглядит обрезанным. Высота как у инпутов. */
.p-select.auth-input {
  border-radius: 16px;
  overflow: clip;
  width: 100%;
  min-height: 48px;
}
.auth-input:deep(.p-select-label) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  min-height: 48px;
  display: flex;
  align-items: center;
  padding: 0.7rem 1rem;
}
.auth-input:deep(.p-select-dropdown) {
  border: 0;
  background: transparent;
  box-shadow: none;
  align-self: stretch;
  padding-right: 0.9rem;
}
.auth-input:deep(.p-select-dropdown-icon) {
  font-size: 0.8rem;
}
/* Дейтпикер: у корня своей рамки нет (рамка была на внутреннем
   input, который мы делаем прозрачным), поэтому рисуем рамку
   пилюли на корне сами — иначе границ вообще не видно. */
.p-datepicker.auth-input {
  border-radius: 16px;
  overflow: clip;
  width: 100%;
  min-height: 48px;
  border: 1px solid #d6d3d1;
  background: #ffffff;
}
:global(html.dark) .p-datepicker.auth-input {
  border-color: #52525b;
  background: #0F121F;
}
.p-datepicker.auth-input:focus-within {
  border-color: #FF4267;
  box-shadow: 0 0 0 1px #FF4267;
}
.p-datepicker.auth-input.p-invalid {
  border-color: #ef4444;
}
.auth-input:deep(.p-datepicker-input) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  min-height: 48px;
  flex: 1 1 auto;
  width: 1%;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 0.7rem 1rem;
}
.auth-input:deep(.p-datepicker-dropdown) {
  border: 0;
  background: transparent;
  box-shadow: none;
  align-self: stretch;
  padding-right: 0.9rem;
}
.auth-input:deep(.p-datepicker-dropdown-icon) {
  font-size: 0.8rem;
}
.reg-progress {
  border-radius: 999px;
  overflow: hidden;
  background: #f4f4f5;
}
.reg-progress :deep(.p-progressbar-value) {
  border-radius: 999px;
  background: #FF4267;
}
:global(html.dark) .reg-progress {
  background: #3f3f46;
}
.reg-step-enter-active,
.reg-step-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.reg-step-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.reg-step-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
@media (prefers-reduced-motion: reduce) {
  .reg-step-enter-active,
  .reg-step-leave-active {
    transition: none;
  }
}
</style>
