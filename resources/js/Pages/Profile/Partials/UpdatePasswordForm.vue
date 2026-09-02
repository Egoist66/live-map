<script setup lang="ts">
import InputError from '@/Components/InputError.vue'
import PrimaryButton from '@/Components/PrimaryButton.vue'
import { useForm } from '@inertiajs/vue3'
import { ref, computed } from 'vue'

const passwordInput = ref<HTMLInputElement | null>(null)
const currentPasswordInput = ref<HTMLInputElement | null>(null)
const show1 = ref(false)
const show2 = ref(false)
const show3 = ref(false)

const form = useForm({ current_password: '', password: '', password_confirmation: '' })

const canSubmit = computed(() => form.current_password.trim().length > 0 && form.password.trim().length >= 8 && form.password_confirmation.trim().length > 0)

const updatePassword = () => {
  if (!canSubmit.value) {
    if (!form.current_password) form.setError('current_password', 'Поле Текущий пароль обязательно для заполнения.')
    if (!form.password) form.setError('password', 'Поле Пароль обязательно для заполнения.')
    else if (form.password.length < 8) form.setError('password', 'Поле Пароль должно содержать не менее 8 символов.')
    if (!form.password_confirmation) form.setError('password_confirmation', 'Подтвердите новый пароль.')
    else if (form.password !== form.password_confirmation) form.setError('password_confirmation', 'Подтверждение пароля не совпадает.')
    return
  }
  form.put(route('password.update'), {
    preserveScroll: true,
    onSuccess: () => form.reset(),
    onError: () => {
      if (form.errors.password) { form.reset('password', 'password_confirmation'); passwordInput.value?.focus() }
      if (form.errors.current_password) { form.reset('current_password'); currentPasswordInput.value?.focus() }
    },
  })
}
</script>

<template>
  <section>
    <header>
      <h2 class="font-bold dark:text-white">Смена пароля</h2>
      <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Минимум 8 символов. Используй сочетание букв, цифр и символов.</p>
    </header>
    <form @submit.prevent="updatePassword" novalidate class="mt-6 space-y-4">
      <div>
        <label class="text-sm font-medium">Текущий пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1"><input id="current_password" ref="currentPasswordInput" v-model="form.current_password" :type="show1?'text':'password'" required minlength="1" autocomplete="current-password" placeholder="••••••••" :class="['w-full border rounded-xl px-3 py-2.5 pr-11 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 transition', form.errors.current_password ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/50' : 'focus:border-ink-900 focus:ring-ink-900/10']"/><button type="button" @click="show1=!show1" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 grid place-items-center text-stone-500">{{ show1?'🙈':'👁' }}</button></div>
        <InputError :message="form.errors.current_password" class="mt-1"/>
      </div>
      <div>
        <label class="text-sm font-medium">Новый пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1"><input id="password" ref="passwordInput" v-model="form.password" :type="show2?'text':'password'" required minlength="8" autocomplete="new-password" placeholder="Не менее 8 символов" :class="['w-full border rounded-xl px-3 py-2.5 pr-11 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 transition', form.errors.password ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/50' : 'focus:border-ink-900 focus:ring-ink-900/10']"/><button type="button" @click="show2=!show2" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 grid place-items-center text-stone-500">{{ show2?'🙈':'👁' }}</button></div>
        <InputError :message="form.errors.password" class="mt-1"/>
        <p v-if="!form.errors.password" class="text-[11px] text-zinc-400 mt-1">Минимум 8 символов, лучше с цифрами и символами</p>
      </div>
      <div>
        <label class="text-sm font-medium">Подтверди пароль <span class="text-red-500">*</span></label>
        <div class="relative mt-1"><input id="password_confirmation" v-model="form.password_confirmation" :type="show3?'text':'password'" required autocomplete="new-password" placeholder="Повтори пароль" :class="['w-full border rounded-xl px-3 py-2.5 pr-11 text-sm dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 transition', form.errors.password_confirmation ? 'border-red-300 focus:border-red-400 focus:ring-red-100 bg-red-50/50' : 'focus:border-ink-900 focus:ring-ink-900/10']"/><button type="button" @click="show3=!show3" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-zinc-800 grid place-items-center text-stone-500">{{ show3?'🙈':'👁' }}</button></div>
        <InputError :message="form.errors.password_confirmation" class="mt-1"/>
      </div>
      <div class="flex items-center gap-3 pt-1">
        <PrimaryButton :disabled="form.processing || !canSubmit" :class="['!bg-black dark:!bg-white dark:!text-ink-900 !rounded-full disabled:opacity-40', !canSubmit ? 'opacity-40 cursor-not-allowed' : '']">Сохранить пароль</PrimaryButton>
        <span v-if="form.recentlySuccessful" class="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-full px-3 py-1">✓ Сохранено</span>
      </div>
    </form>
  </section>
</template>
