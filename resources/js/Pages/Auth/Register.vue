<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import InputError from '@/Components/InputError.vue'
import { Head, Link, useForm } from '@inertiajs/vue3'
const form = useForm({ name:'', email:'', password:'', password_confirmation:'' })
const submit = () => form.post(route('register'), { onFinish: () => form.reset('password','password_confirmation') })
</script>

<template>
  <GuestLayout>
    <Head title="Регистрация — Live Map" />
    <h1 class="text-[22px] font-black tracking-tight">Создай аккаунт</h1>
    <p class="text-sm text-stone-500 mt-1">Выбери район, радиус и стань частью живой карты</p>
    <form @submit.prevent="submit" class="mt-6 space-y-4">
      <div><label class="text-[13px] font-semibold">Имя / ник</label><input v-model="form.name" type="text" required autofocus autocomplete="name" placeholder="Маша" class="mt-1.5 input-premium"/><InputError :message="form.errors.name" class="mt-1.5"/></div>
      <div><label class="text-[13px] font-semibold">Email</label><input v-model="form.email" type="email" required autocomplete="username" placeholder="you@mail.ru" class="mt-1.5 input-premium"/><InputError :message="form.errors.email" class="mt-1.5"/></div>
      <div><label class="text-[13px] font-semibold">Пароль</label><input v-model="form.password" type="password" required autocomplete="new-password" placeholder="••••••••" class="mt-1.5 input-premium"/><InputError :message="form.errors.password" class="mt-1.5"/></div>
      <div><label class="text-[13px] font-semibold">Подтверди пароль</label><input v-model="form.password_confirmation" type="password" required placeholder="••••••••" class="mt-1.5 input-premium"/><InputError :message="form.errors.password_confirmation" class="mt-1.5"/></div>
      <button :disabled="form.processing" class="w-full bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 shadow-soft transition disabled:opacity-50 inline-flex items-center justify-center gap-2">Создать аккаунт <span>→</span></button>
      <div class="text-sm text-center text-stone-500">Уже есть? <Link :href="route('login')" class="font-semibold text-ink-900 hover:underline">Войти</Link></div>
      <div class="text-[11px] text-stone-400 text-center bg-stone-50 border rounded-full px-3 py-2">🔒 Приватность по умолчанию · Размытие 200м</div>
    </form>
  </GuestLayout>
</template>
