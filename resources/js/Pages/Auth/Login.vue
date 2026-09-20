<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { useLoginForm } from '@/composables/useAuthForm'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Message from 'primevue/message'
defineProps<{ canResetPassword: boolean; status?: string | null }>()
const { email, emailAttrs, password, passwordAttrs, remember, errors, showPass, submit, isSubmitting } = useLoginForm()
</script>

<template>
  <Head title="Вход" />
    <Message v-if="status" severity="success" class="mb-4 w-full">{{ status }}</Message>
    <h1 class="text-[22px] font-black tracking-tight text-ink-900 dark:text-white">С возвращением</h1>
    <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">💘 ULove с мэтчами и 📍 пины района уже ждут</p>
    <form @submit.prevent="submit" class="mt-6 space-y-4">
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Email</label>
        <InputText v-model="email" v-bind="emailAttrs" type="email" placeholder="you@mail.ru" class="w-full mt-1.5" :invalid="!!errors.email" />
        <small class="text-red-500 dark:text-red-400">{{ errors.email }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="password" v-bind="passwordAttrs" :type="showPass ? 'text' : 'password'" placeholder="••••••••" class="w-full pr-11" :invalid="!!errors.password" />
          <button type="button" @click="showPass=!showPass" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1" aria-label="Показать пароль">{{ showPass?'🙈':'👁' }}</button>
        </div>
        <small class="text-red-500 dark:text-red-400">{{ errors.password }}</small>
      </div>
      <label class="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-zinc-200">
        <Checkbox v-model="remember" :binary="true" /> Запомнить меня
      </label>
      <Button :loading="isSubmitting" type="submit" label="Войти →" class="w-full !bg-ink-900 dark:!bg-[#FAFAFA] !border-ink-900 dark:!border-[#FAFAFA] !text-white dark:!text-[#0F172A] !rounded-full !py-3.5 [&_.p-button-label]:!text-white dark:[&_.p-button-label]:!text-[#0F172A]" />
      <div class="flex justify-between items-center gap-2 text-sm pt-2">
        <Link v-if="canResetPassword" :href="route('password.request')" class="text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white font-medium shrink-0">Забыли пароль?</Link>
        <Link :href="route('register')" class="font-semibold bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-ink-900 dark:text-white border border-stone-200 dark:border-zinc-700 rounded-full px-4 py-2 transition shrink-0">Регистрация →</Link>
      </div>
    </form>
</template>
