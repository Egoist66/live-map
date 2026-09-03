<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import { useRegisterForm } from '@/composables/useAuthForm'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
const f = useRegisterForm()
</script>

<template>
  <GuestLayout>
    <Head title="Регистрация" />
    <h1 class="text-[22px] font-black tracking-tight">Создай аккаунт</h1>
    <p class="text-sm text-stone-500 mt-1">Выбери район, радиус и стань частью живой карты</p>
    <form @submit.prevent="f.submit" class="mt-6 space-y-4">
      <div>
        <label class="text-[13px] font-semibold">Имя / ник</label>
        <InputText v-model="f.name.value" v-bind="f.nameAttrs" placeholder="Роберт Дауни" class="w-full mt-1.5" :invalid="!!f.errors.value.name" />
        <small class="text-red-500">{{ f.errors.value.name }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold">Email</label>
        <InputText v-model="f.email.value" v-bind="f.emailAttrs" type="email" placeholder="you@mail.ru" class="w-full mt-1.5" :invalid="!!f.errors.value.email" />
        <small class="text-red-500">{{ f.errors.value.email }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold">Пароль</label>
        <InputText v-model="f.password.value" v-bind="f.passwordAttrs" :type="f.showPass.value ? 'text' : 'password'" placeholder="••••••••" class="w-full mt-1.5" :invalid="!!f.errors.value.password" />
        <small class="text-red-500">{{ f.errors.value.password }}</small>
        <button type="button" @click="f.showPass.value=!f.showPass.value" class="text-xs text-stone-500 mt-1">{{ f.showPass.value ? 'Скрыть' : 'Показать' }}</button>
      </div>
      <div>
        <label class="text-[13px] font-semibold">Подтверди пароль</label>
        <InputText v-model="f.password_confirmation.value" v-bind="f.passwordConfirmationAttrs" :type="f.showPass2.value ? 'text' : 'password'" placeholder="••••••••" class="w-full mt-1.5" :invalid="!!f.errors.value.password_confirmation" />
        <small class="text-red-500">{{ f.errors.value.password_confirmation }}</small>
      </div>
      <div class="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2.5">
        <div class="flex items-center justify-between">
          <label class="text-[13px] font-semibold">Домашняя зона</label>
          <span class="text-[11px] font-bold bg-white border border-stone-200 rounded-full px-2.5 py-1">{{ f.values.home_radius_km }} км</span>
        </div>
        <p class="text-[11px] text-stone-500 leading-relaxed">Выбери район где живёшь/бываешь — пин видят только рядом.</p>
        <Button type="button" @click="f.detectLocation" :loading="f.locating.value" severity="secondary" outlined rounded class="w-full" :label="f.values.home_lat ? 'Обновить моё место' : 'Определить моё место'" icon="pi pi-map-marker" />
        <div v-if="f.values.home_address || f.addrLoading.value" class="bg-white border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0 text-[11px]">◉</span>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold truncate">{{ f.addrLoading.value ? 'Определяем район…' : f.values.home_address }}</div>
            <div v-if="f.values.home_lat" class="text-[11px] text-stone-400 font-mono">{{ f.values.home_lat }}, {{ f.values.home_lng }}</div>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-1.5">
          <button v-for="r in [1,2,5,10]" :key="r" type="button" @click="f.setValues({ home_radius_km: r } as any)" :class="['rounded-full py-2 text-xs font-semibold border', f.values.home_radius_km===r?'bg-ink-900 text-white border-ink-900':'bg-white border-stone-200']">{{ r }} км</button>
        </div>
      </div>
      <Button :loading="f.isSubmitting.value" type="submit" label="Создать аккаунт →" class="w-full !bg-ink-900 dark:!bg-white !border-ink-900 dark:!border-white !text-white dark:!text-ink-900 !rounded-full !py-3.5 [&_.p-button-label]:!text-white dark:[&_.p-button-label]:!text-ink-900" />
      <div class="text-sm text-center text-stone-500 dark:text-zinc-400">Уже есть? <Link :href="route('login')" class="font-semibold text-ink-900 dark:text-white hover:underline">Войти</Link></div>
    </form>
  </GuestLayout>
</template>
