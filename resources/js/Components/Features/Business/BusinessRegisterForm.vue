<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { useBusinessRegisterForm } from '@/composables/useBusinessRegisterForm'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Select from 'primevue/select'

const form = useBusinessRegisterForm()
</script>

<template>
  <div>
    <div class="flex items-center gap-3">
      <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 grid place-items-center text-white shrink-0"><i class="pi pi-briefcase" /></span>
      <div class="min-w-0">
        <h1 class="text-[22px] font-black tracking-tight text-ink-900 dark:text-white leading-tight">Регистрация компании</h1>
        <p class="text-[13px] text-stone-500 dark:text-zinc-400">Кабинет для бизнеса · проверка по УНП · карта для клиентов</p>
      </div>
    </div>

    <div class="mt-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 px-3.5 py-3 text-[12px] leading-relaxed text-indigo-900 dark:text-indigo-200">
      Работаем по законодательству Республики Беларусь: нужны форма собственности, УНП из 9 цифр и юридический адрес. После регистрации откроем кабинет — заполните точку на карте и отправьте заявку на проверку.
    </div>

    <form class="mt-5 space-y-4" @submit.prevent="form.submit">
      <div>
        <label class="auth-label">Название компании *</label>
        <InputText v-model="form.name.value" v-bind="form.nameAttrs" placeholder="ООО «Кофейня у парка»" class="w-full mt-1.5 auth-input" :invalid="!!form.errors.value.name" />
        <small class="auth-err">{{ form.errors.value.name }}</small>
      </div>

      <div>
        <label class="auth-label">Рабочий email компании *</label>
        <InputText v-model="form.email.value" v-bind="form.emailAttrs" type="email" placeholder="info@company.by" class="w-full mt-1.5 auth-input" :invalid="!!form.errors.value.email" />
        <small class="auth-err">{{ form.errors.value.email }}</small>
      </div>

      <div>
        <label class="auth-label">Форма собственности *</label>
        <Select v-model="form.legalForm.value" :options="form.legalFormOptions" option-label="label" option-value="value" checkmark fluid class="w-full mt-1.5 auth-input" :invalid="!!form.errors.value.legal_form" />
        <small class="auth-err">{{ form.errors.value.legal_form }}</small>
      </div>

      <div class="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
        <div class="min-w-0">
          <label class="auth-label">УНП (9 цифр) *</label>
          <InputText v-model="form.unp.value" v-bind="form.unpAttrs" inputmode="numeric" placeholder="123456789" class="w-full mt-1.5 auth-input font-mono" :invalid="!!form.errors.value.unp" />
          <small class="auth-err">{{ form.errors.value.unp }}</small>
        </div>
        <div class="min-w-0">
          <label class="auth-label">Город</label>
          <InputText v-model="form.homeCity.value" placeholder="Минск" class="w-full mt-1.5 auth-input" :invalid="!!form.errors.value.home_city" />
          <small class="auth-err">{{ form.errors.value.home_city }}</small>
        </div>
      </div>

      <div>
        <label class="auth-label">Юридический адрес *</label>
        <InputText v-model="form.legalAddress.value" v-bind="form.legalAddressAttrs" placeholder="г. Минск, ул. Ленина, 1, офис 10" class="w-full mt-1.5 auth-input" :invalid="!!form.errors.value.legal_address" />
        <small class="auth-err">{{ form.errors.value.legal_address }}</small>
      </div>

      <div>
        <label class="auth-label">Бренд</label>
        <InputText v-model="form.brand.value" placeholder="Как клиенты ищут вас на карте" class="w-full mt-1.5 auth-input" :invalid="!!form.errors.value.brand" />
        <small class="auth-err">{{ form.errors.value.brand }}</small>
      </div>

      <div>
        <label class="auth-label">Телефон компании</label>
        <InputText v-model="form.phone.value" placeholder="+375 29 000-00-00" class="w-full mt-1.5 auth-input" :invalid="!!form.errors.value.phone" />
        <small class="auth-err">{{ form.errors.value.phone }}</small>
      </div>

      <div>
        <label class="auth-label">Пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="form.password.value" v-bind="form.passwordAttrs" :type="form.showPass.value ? 'text' : 'password'" placeholder="Минимум 8 символов" class="w-full auth-input !pr-11" :invalid="!!form.errors.value.password" />
          <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1" @click="form.showPass.value = !form.showPass.value"><i :class="form.showPass.value ? 'pi pi-eye-slash' : 'pi pi-eye'" /></button>
        </div>
        <small class="auth-err">{{ form.errors.value.password }}</small>
      </div>

      <div>
        <label class="auth-label">Подтвердите пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="form.passwordConfirmation.value" v-bind="form.passwordConfirmationAttrs" :type="form.showPass2.value ? 'text' : 'password'" placeholder="Повторите пароль" class="w-full auth-input !pr-11" :invalid="!!form.errors.value.password_confirmation" />
          <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1" @click="form.showPass2.value = !form.showPass2.value"><i :class="form.showPass2.value ? 'pi pi-eye-slash' : 'pi pi-eye'" /></button>
        </div>
        <small class="auth-err">{{ form.errors.value.password_confirmation }}</small>
      </div>

      <Button :loading="form.isSubmitting.value" type="submit" label="Создать кабинет компании →" class="w-full !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !border-0 !text-white !rounded-full !py-3.5" />
      <div class="text-sm text-center text-stone-500 dark:text-zinc-400">Уже есть кабинет? <Link href="/login?account=business" class="font-semibold text-ink-900 dark:text-white hover:underline">Войти</Link></div>
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
.auth-input:deep(.p-inputtext),
.auth-input:deep(.p-select-label),
.auth-input:deep(input) {
  border-radius: 16px;
}
.auth-input:deep(.p-select) {
  border-radius: 16px;
}
</style>
