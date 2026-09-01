<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import InputError from '@/Components/InputError.vue'
import { Head, Link, useForm } from '@inertiajs/vue3'
defineProps<{ canResetPassword: boolean; status: string }>()
const form = useForm({ email:'', password:'', remember:false })
const submit = () => form.post(route('login'), { onFinish: () => form.reset('password') })
</script>

<template>
  <GuestLayout>
    <Head title="Вход — Live Map" />
    <div v-if="status" class="mb-4 text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3">{{ status }}</div>
    <h1 class="text-[22px] font-black tracking-tight">С возвращением</h1>
    <p class="text-sm text-stone-500 mt-1">Войди и проверь, что происходит во дворе</p>
    <form @submit.prevent="submit" class="mt-6 space-y-4">
      <div><label class="text-[13px] font-semibold">Email</label><input v-model="form.email" type="email" required autofocus autocomplete="username" placeholder="you@mail.ru" class="mt-1.5 input-premium"/><InputError :message="form.errors.email" class="mt-1.5"/></div>
      <div><label class="text-[13px] font-semibold">Пароль</label><input v-model="form.password" type="password" required autocomplete="current-password" placeholder="••••••••" class="mt-1.5 input-premium"/><InputError :message="form.errors.password" class="mt-1.5"/></div>
      <label class="flex items-center gap-2 text-sm font-medium"><input type="checkbox" v-model="form.remember" class="rounded border-stone-300 text-ink-900 focus:ring-ink-900"/> Запомнить меня</label>
      <button :disabled="form.processing" class="w-full bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 shadow-soft transition disabled:opacity-50 inline-flex items-center justify-center gap-2">Войти <span>→</span></button>
      <div class="flex justify-between items-center text-sm pt-2">
        <Link v-if="canResetPassword" :href="route('password.request')" class="text-stone-500 hover:text-ink-900 font-medium">Забыли пароль?</Link>
        <Link :href="route('register')" class="font-semibold bg-stone-100 hover:bg-stone-200 rounded-full px-4 py-2 transition">Регистрация →</Link>
      </div>
    </form>
  </GuestLayout>
</template>
