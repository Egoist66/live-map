<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { useLoginForm } from '@/composables/useAuthForm'
import { useAuthMode, tabClass } from '@/composables/useAuthMode'
import { useAuthTheme } from '@/composables/useAuthTheme'
import RegisterForm from '@/Components/Auth/RegisterForm.vue'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import Message from 'primevue/message'

/**
 * Единая страница входа: тогл «Войти / Регистрация».
 * По умолчанию всегда вход.
 */
const props = defineProps<{ canResetPassword: boolean; status?: string | null }>()

const { mode, isLogin, showLogin, showRegister } = useAuthMode()
const { email, emailAttrs, password, passwordAttrs, remember, errors, showPass, submit, isSubmitting } = useLoginForm()
const t = useAuthTheme()

const pageTitle = computed(() => (isLogin.value ? 'Вход — ULove' : 'Регистрация — ULove'))
</script>

<template>
  <Head :title="pageTitle" />
    <Message v-if="status" severity="success" class="mb-4 w-full">{{ status }}</Message>
    <div class="grid grid-cols-2 gap-1 rounded-full bg-stone-100 dark:bg-zinc-800 p-1 mb-6">
      <Button type="button" label="Войти" rounded :class="tabClass(isLogin)" @click="showLogin" />
      <Button type="button" label="Регистрация" rounded :class="tabClass(!isLogin)" @click="showRegister" />
    </div>
    <div v-if="isLogin">
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400 grid place-items-center text-white shadow-lg shadow-rose-500/30 shrink-0"><i class="pi pi-heart-fill leading-none" /></span>
        <div class="min-w-0">
          <h1 class="text-[22px] font-black tracking-tight text-ink-900 dark:text-white leading-tight">{{ t.loginTitle.value }}</h1>
          <p class="text-[13px] text-stone-500 dark:text-zinc-400">{{ t.loginSub.value }}</p>
        </div>
      </div>
      <form @submit.prevent="submit" class="mt-6 space-y-4">
        <div>
          <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Email</label>
          <InputText v-model="email" v-bind="emailAttrs" type="email" placeholder="you@mail.ru" autocomplete="email" class="w-full mt-1.5" :invalid="!!errors.email" />
          <small class="text-red-500 dark:text-red-400">{{ errors.email }}</small>
        </div>
        <div>
          <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Пароль</label>
          <div class="relative mt-1.5">
            <InputText v-model="password" v-bind="passwordAttrs" :type="showPass ? 'text' : 'password'" placeholder="••••••••" autocomplete="current-password" class="w-full pr-11" :invalid="!!errors.password" />
            <button type="button" @click="showPass=!showPass" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1" aria-label="Показать пароль"><i :class="showPass ? 'pi pi-eye-slash' : 'pi pi-eye'" /></button>
          </div>
          <small class="text-red-500 dark:text-red-400">{{ errors.password }}</small>
        </div>
        <label class="flex items-center gap-2 text-sm font-medium text-ink-900 dark:text-zinc-200">
          <Checkbox v-model="remember" :binary="true" /> Запомнить меня
        </label>
        <Button :loading="isSubmitting" type="submit" label="Войти →" :class="t.submitClass.value" />
        <div class="flex justify-start items-center gap-2 text-sm pt-2">
          <Link v-if="canResetPassword" :href="route('password.request')" class="text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white font-medium shrink-0">Забыли пароль?</Link>
        </div>
      </form>
    </div>
    <RegisterForm v-else :key="mode" @switch-login="showLogin" />
</template>
