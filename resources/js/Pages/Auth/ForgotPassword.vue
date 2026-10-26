<script setup lang="ts">
import { Head, Link, useForm } from '@inertiajs/vue3'
import { route } from '@/route'
import { ref } from 'vue'
import { useHoneypot } from '@/composables/useTurnstile'
import { useAuthTheme } from '@/composables/useAuthTheme'
import TurnstileWidget from '@/Components/Security/TurnstileWidget.vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'

/**
 * Тематичная форма восстановления пароля в стиле ULove:
 * сердечко-шапка, брендовый #FF4267 на сабмите, тёмная тема.
 * Логика минимальна: Inertia useForm + honeypot + Turnstile.
 */
const props = defineProps<{ status?: string | null }>()

const t = useAuthTheme()

const form = useForm({ email: '', captcha_token: '', website: '' as string | undefined })
const captchaToken = ref('')
const trap = useHoneypot()

const submit = () => {
  form.captcha_token = captchaToken.value
  form.website = trap.value.value || undefined
  form.post(route('password.email'))
}
</script>
<template>
  <Head title="Восстановление пароля" />
  <div class="flex flex-col items-center text-center gap-2">
    <span class="w-11 h-11 rounded-2xl bg-[#FF4267] grid place-items-center text-white shadow-lg shadow-[#FF4267]/30 shrink-0"><i class="pi pi-heart-fill leading-none" /></span>
    <h1 class="text-[22px] font-black tracking-tight text-ink-900 dark:text-white leading-tight">Восстановить доступ</h1>
    <p class="text-[13px] text-stone-500 dark:text-zinc-400">Пришлём ссылку для сброса пароля на твой email</p>
  </div>

  <Message v-if="props.status" severity="success" :closable="false" class="mt-4 !rounded-2xl">{{ props.status }}</Message>

  <form @submit.prevent="submit" class="mt-5 space-y-4">
    <div class="min-w-0">
      <label for="forgot-email" class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Email</label>
      <InputText id="forgot-email" v-model="form.email" type="email" placeholder="you@mail.ru" class="w-full mt-1.5 forgot-input" :invalid="!!form.errors.email" required autofocus autocomplete="username" />
      <Message v-if="form.errors.email" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.email }}</Message>
    </div>
    <input v-model="trap.value.value" :name="trap.fieldName" type="text" :class="trap.hiddenClass" tabindex="-1" autocomplete="off" aria-hidden="true" />
    <TurnstileWidget v-model:token="captchaToken" />
    <Message v-if="form.errors.captcha_token" severity="error" :closable="false" class="mt-1 !rounded-xl !py-1 !text-xs">{{ form.errors.captcha_token }}</Message>
    <Button type="submit" :loading="form.processing" label="Отправить ссылку →" :class="t.submitClass.value" />
  </form>

  <div class="mt-4 text-center text-[13px] text-stone-500 dark:text-zinc-400">
    Вспомнил пароль?
    <Link :href="route('login')" class="font-semibold text-ink-900 dark:text-white hover:underline">Войти</Link>
  </div>
</template>

<style scoped>
/* Инпут: корень InputText — сам <input>, поэтому высоту, ширину
   и пилюльное скругление задаём напрямую корню (как в RegisterForm). */
input.p-inputtext.forgot-input {
  border-radius: 16px;
  min-height: 48px;
  width: 100%;
  padding: 0.7rem 1rem;
}
</style>
