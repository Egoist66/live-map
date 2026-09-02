<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import { useLoginForm } from '@/composables/useAuthForm'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Message from 'primevue/message'
defineProps<{ canResetPassword: boolean; status?: string | null }>()
const { email, emailAttrs, password, passwordAttrs, remember, errors, showPass, submit, isSubmitting } = useLoginForm()
</script>

<template>
  <GuestLayout>
    <Head title="Вход" />
    <Message v-if="status" severity="success" class="mb-4 w-full">{{ status }}</Message>
    <h1 class="text-[22px] font-black tracking-tight">С возвращением</h1>
    <p class="text-sm text-stone-500 mt-1">Войди и проверь, что происходит во дворе</p>
    <form @submit.prevent="submit" class="mt-6 space-y-4">
      <div>
        <label class="text-[13px] font-semibold">Email</label>
        <InputText v-model="email" v-bind="emailAttrs" type="email" placeholder="you@mail.ru" class="w-full mt-1.5" :invalid="!!errors.email" />
        <small class="text-red-500">{{ errors.email }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold">Пароль</label>
        <div class="mt-1.5">
          <InputText v-model="password" v-bind="passwordAttrs" :type="showPass ? 'text' : 'password'" placeholder="••••••••" class="w-full" :invalid="!!errors.password" />
        </div>
        <small class="text-red-500">{{ errors.password }}</small>
        <button type="button" @click="showPass=!showPass" class="text-xs text-stone-500 mt-1">{{ showPass ? 'Скрыть' : 'Показать' }} пароль</button>
      </div>
      <label class="flex items-center gap-2 text-sm font-medium">
        <Checkbox v-model="remember" :binary="true" /> Запомнить меня
      </label>
      <Button :loading="isSubmitting" type="submit" label="Войти →" class="w-full !bg-ink-900 !border-ink-900 !rounded-full !py-3.5" />
      <div class="flex justify-between items-center text-sm pt-2">
        <Link v-if="canResetPassword" :href="route('password.request')" class="text-stone-500 hover:text-ink-900 font-medium">Забыли пароль?</Link>
        <Link :href="route('register')" class="font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-4 py-2 transition">Регистрация →</Link>
      </div>
    </form>
  </GuestLayout>
</template>
