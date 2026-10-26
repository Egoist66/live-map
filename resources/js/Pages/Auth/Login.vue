<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { useLoginForm } from '@/composables/useAuthForm'
import { useAuthMode, tabClass } from '@/composables/useAuthMode'
import { useAuthTheme } from '@/composables/useAuthTheme'
import { useBannedNotice } from '@/composables/useBannedNotice'
import { useTelegram } from '@/composables/useTelegram'
import { useTelegramAuth } from '@/composables/useTelegramAuth'
import RegisterForm from '@/Components/Auth/RegisterForm.vue'
import TurnstileWidget from '@/Components/Security/TurnstileWidget.vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

/**
 * Единая страница входа: тогл «Войти / Регистрация».
 * По умолчанию всегда вход.
 */
const props = defineProps<{ canResetPassword: boolean; status?: string | null }>()

const { mode, isLogin, showLogin, showRegister } = useAuthMode()
const { email, emailAttrs, password, passwordAttrs, errors, showPass, submit, isSubmitting, captchaToken, trap } = useLoginForm()
const t = useAuthTheme()

// Telegram Mini App: только отображение статуса автовхода,
// вся логика — в useTelegramAuth (Правило №1).
const { isTelegram } = useTelegram()
const { status: tgStatus, errorMessage: tgError, retryTelegramAuth } = useTelegramAuth()

const banned = useBannedNotice(() => [errors.value.email, tgError.value])

const pageTitle = computed(() => (isLogin.value ? 'Вход — ULove' : 'Регистрация — ULove'))
</script>

<template>
  <Head :title="pageTitle" />
    <Message v-if="status" severity="success" class="mb-4 w-full">{{ status }}</Message>
    <div v-if="isTelegram && tgStatus === 'loading'" class="mb-4 flex items-center gap-3 rounded-2xl bg-stone-100 dark:bg-zinc-800 px-4 py-3">
      <ProgressSpinner style="width: 28px; height: 28px" :strokeWidth="5" aria-label="Вход через Telegram" />
      <p class="text-[13px] font-medium text-stone-600 dark:text-zinc-300">Входим через Telegram…</p>
    </div>
    <Message v-if="isTelegram && tgStatus === 'error'" severity="error" class="mb-4 w-full">
      <span class="block">{{ tgError }}</span>
      <Button type="button" label="Попробовать снова" size="small" class="mt-2" @click="retryTelegramAuth" />
    </Message>
    <div class="auth-toggle grid w-full grid-cols-2 gap-0 mb-6" role="tablist">
      <Button type="button" label="Войти" role="tab" :aria-selected="isLogin" :aria-pressed="isLogin" :class="tabClass(isLogin)" @click="showLogin" />
      <Button type="button" label="Регистрация" role="tab" :aria-selected="!isLogin" :aria-pressed="!isLogin" :class="tabClass(!isLogin)" @click="showRegister" />
    </div>
    <div v-if="isLogin">
      <form @submit.prevent="submit" class="space-y-4">
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
        <input v-model="trap.value.value" :name="trap.fieldName" type="text" :class="trap.hiddenClass" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <TurnstileWidget v-model:token="captchaToken" />
        <small v-if="errors.captcha_token" class="text-red-500 dark:text-red-400">{{ errors.captcha_token }}</small>
        <Button :loading="isSubmitting" type="submit" label="Войти →" :class="t.submitClass.value" />
        <div class="flex justify-start items-center gap-2 text-sm pt-2">
          <Link v-if="canResetPassword" :href="route('password.request')" class="text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white font-medium shrink-0">Забыли пароль?</Link>
        </div>
      </form>
    </div>
    <RegisterForm v-else :key="mode" @switch-login="showLogin" />
    <Dialog :visible="banned.bannedVisible.value" @update:visible="(v:boolean)=>{ if(!v) banned.closeBanned() }" modal :draggable="false" header="Доступ запрещён" :style="{ width: '380px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-3xl max-sm:!rounded-b-none dark:!bg-zinc-900 dark:!border-zinc-700' }, header: { class: 'dark:!bg-zinc-900 dark:!text-white' }, content: { class: 'dark:!bg-zinc-900 dark:!text-zinc-100' } }">
      <div class="text-center py-2">
        <div class="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 text-red-500 grid place-items-center"><i class="pi pi-ban text-xl" /></div>
        <div class="mt-3 text-lg font-black text-stone-900 dark:text-white">Аккаунт заблокирован</div>
        <p class="mt-1 text-sm text-stone-500 dark:text-zinc-400">Вход закрыт. Если кажется, что это ошибка — напиши нам.</p>
        <div class="mt-4 flex gap-2 justify-center flex-wrap">
          <Button label="Понятно" severity="secondary" rounded outlined @click="banned.closeBanned()" />
          <Link href="/contacts"><Button label="Написать нам" icon="pi pi-send" rounded class="!bg-[#FF4267] !border-0 !text-white" /></Link>
        </div>
      </div>
    </Dialog>
</template>

<style scoped>
/* Тогл «Войти / Регистрация»: убираем дефолтное белое кольцо фокуса
   PrimeVue (на тёмной теме оно вспыхивало при переключении) и
   подменяем его мягким фирменным #FF4267 — аккуратно и доступно. */
.auth-toggle :deep(.p-button) {
  --p-button-focus-ring-color: rgba(255, 66, 103, 0.5);
  --p-button-focus-ring-width: 2px;
  --p-button-focus-ring-offset: 2px;
}
.auth-toggle :deep(.p-button:focus:not(:focus-visible)) {
  outline: none;
}
</style>
