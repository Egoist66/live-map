<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import InputError from '@/Components/InputError.vue'
import { Head, Link, useForm } from '@inertiajs/vue3'
import { ref } from 'vue'
const form = useForm({ name:'', email:'', password:'', password_confirmation:'', home_lat: null as any, home_lng: null as any, home_radius_km: 2, home_address: '' })
const showPass = ref(false)
const showPass2 = ref(false)
const locating = ref(false)
const addrLoading = ref(false)
async function detectLocation() {
  locating.value = true
  try {
    const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 6000 }))
    form.home_lat = Number(pos.coords.latitude.toFixed(7))
    form.home_lng = Number(pos.coords.longitude.toFixed(7))
    addrLoading.value = true
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${form.home_lat}&lon=${form.home_lng}&zoom=14&accept-language=ru`)
      const d: any = await r.json()
      const a = d.address || {}
      const city = a.city || a.town || a.village || ''
      const road = a.road || a.suburb || ''
      form.home_address = [road, city].filter(Boolean).join(' · ') || d.display_name?.split(',').slice(0,2).join(', ') || `${form.home_lat}, ${form.home_lng}`
    } catch { form.home_address = `${form.home_lat}, ${form.home_lng}` }
    finally { addrLoading.value = false }
  } catch { alert('Не удалось определить местоположение') }
  finally { locating.value = false }
}
const submit = () => form.post(route('register'), { onFinish: () => form.reset('password','password_confirmation') })
</script>

<template>
  <GuestLayout>
    <Head title="Регистрация" />
    <h1 class="text-[22px] font-black tracking-tight">Создай аккаунт</h1>
    <p class="text-sm text-stone-500 mt-1">Выбери район, радиус и стань частью живой карты</p>
    <form @submit.prevent="submit" class="mt-6 space-y-4">
      <div><label class="text-[13px] font-semibold">Имя / ник</label><input v-model="form.name" type="text" required autofocus autocomplete="name" placeholder="Роберт Дауни" class="mt-1.5 input-premium"/><InputError :message="form.errors.name" class="mt-1.5"/></div>
      <div><label class="text-[13px] font-semibold">Email</label><input v-model="form.email" type="email" required autocomplete="username" placeholder="you@mail.ru" class="mt-1.5 input-premium"/><InputError :message="form.errors.email" class="mt-1.5"/></div>
      <div><label class="text-[13px] font-semibold">Пароль</label><div class="relative mt-1.5"><input v-model="form.password" :type="showPass?'text':'password'" required autocomplete="new-password" placeholder="••••••••" class="input-premium !mt-0 pr-11"/><button type="button" @click="showPass=!showPass" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500" :title="showPass?'Скрыть':'Показать'"><span class="text-[13px]">{{ showPass ? '🙈' : '👁' }}</span></button></div><InputError :message="form.errors.password" class="mt-1.5"/></div>
      <div><label class="text-[13px] font-semibold">Подтверди пароль</label><div class="relative mt-1.5"><input v-model="form.password_confirmation" :type="showPass2?'text':'password'" required placeholder="••••••••" class="input-premium !mt-0 pr-11"/><button type="button" @click="showPass2=!showPass2" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 grid place-items-center text-stone-500" :title="showPass2?'Скрыть':'Показать'"><span class="text-[13px]">{{ showPass2 ? '🙈' : '👁' }}</span></button></div><InputError :message="form.errors.password_confirmation" class="mt-1.5"/></div>
      <div class="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 space-y-2.5">
        <div class="flex items-center justify-between">
          <label class="text-[13px] font-semibold">Домашняя зона</label>
          <span class="text-[11px] font-bold bg-white border border-stone-200 rounded-full px-2.5 py-1">{{ form.home_radius_km }} км</span>
        </div>
        <p class="text-[11px] text-stone-500 leading-relaxed">Выбери район где живёшь/бываешь — пин видят только рядом. Адрес не храним как точный.</p>
        <button type="button" @click="detectLocation" :disabled="locating" class="w-full bg-white border border-stone-200 rounded-full py-2.5 text-xs font-semibold hover:bg-stone-50 flex items-center justify-center gap-2 disabled:opacity-50">
          <span v-if="locating" class="w-3.5 h-3.5 border-2 border-stone-200 border-t-ink-900 rounded-full animate-spin"></span>
          <span v-else>📍</span> {{ form.home_lat ? 'Обновить моё место' : 'Определить моё место' }}
        </button>
        <div v-if="form.home_address || addrLoading" class="bg-white border border-stone-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <span class="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center shrink-0 text-[11px]">◉</span>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold truncate">{{ addrLoading ? 'Определяем район…' : form.home_address }}</div>
            <div v-if="form.home_lat" class="text-[11px] text-stone-400 font-mono">{{ form.home_lat }}, {{ form.home_lng }}</div>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-1.5">
          <button v-for="r in [1,2,5,10]" :key="r" type="button" @click="form.home_radius_km=r" :class="['rounded-full py-2 text-xs font-semibold border', form.home_radius_km===r?'bg-ink-900 text-white border-ink-900':'bg-white border-stone-200']">{{ r }} км</button>
        </div>
        <InputError :message="form.errors.home_lat" class="mt-1"/>
      </div>
      <button :disabled="form.processing" class="w-full bg-ink-900 text-white rounded-full py-3.5 font-semibold hover:bg-ink-800 shadow-soft transition disabled:opacity-50 inline-flex items-center justify-center gap-2">Создать аккаунт <span>→</span></button>
      <div class="text-sm text-center text-stone-500">Уже есть? <Link :href="route('login')" class="font-semibold text-ink-900 hover:underline">Войти</Link></div>
      <div class="text-[11px] text-stone-400 text-center bg-stone-50 border rounded-full px-3 py-2">🔒 Приватность по умолчанию · Размытие 200м</div>
    </form>
  </GuestLayout>
</template>
