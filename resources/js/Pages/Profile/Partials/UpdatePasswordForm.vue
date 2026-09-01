<script setup lang="ts">
import InputError from '@/Components/InputError.vue'
import PrimaryButton from '@/Components/PrimaryButton.vue'
import { useForm } from '@inertiajs/vue3'
import { ref } from 'vue'

const passwordInput = ref<HTMLInputElement | null>(null)
const currentPasswordInput = ref<HTMLInputElement | null>(null)

const form = useForm({ current_password: '', password: '', password_confirmation: '' })

const updatePassword = () => {
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
      <h2 class="font-bold">Смена пароля</h2>
      <p class="text-sm text-zinc-500 mt-1">Используй длинный случайный пароль для безопасности аккаунта.</p>
    </header>
    <form @submit.prevent="updatePassword" class="mt-6 space-y-4">
      <div><label class="text-sm font-medium">Текущий пароль</label><input id="current_password" ref="currentPasswordInput" v-model="form.current_password" type="password" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm" autocomplete="current-password"/><InputError :message="form.errors.current_password" class="mt-1"/></div>
      <div><label class="text-sm font-medium">Новый пароль</label><input id="password" ref="passwordInput" v-model="form.password" type="password" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm" autocomplete="new-password"/><InputError :message="form.errors.password" class="mt-1"/></div>
      <div><label class="text-sm font-medium">Подтверди пароль</label><input id="password_confirmation" v-model="form.password_confirmation" type="password" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm" autocomplete="new-password"/><InputError :message="form.errors.password_confirmation" class="mt-1"/></div>
      <div class="flex items-center gap-3">
        <PrimaryButton :disabled="form.processing" class="!bg-black !rounded-full">Сохранить пароль</PrimaryButton>
        <span v-if="form.recentlySuccessful" class="text-sm text-green-600">Сохранено</span>
      </div>
    </form>
  </section>
</template>
