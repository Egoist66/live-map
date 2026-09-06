<script setup lang="ts">
import GuestLayout from '@/Layouts/GuestLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import { useRegisterForm } from '@/composables/useAuthForm'
import { useGender } from '@/composables/useGender'
import { useUserAge } from '@/composables/useUserAge'
import { RESIDENCE_COUNTRIES } from '@/composables/useResidence'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import HomeZoneField from '@/Components/Features/HomeZone/HomeZoneField.vue'
const f = useRegisterForm()
const g = useGender()
const { label: ageLabel } = useUserAge(() => (f.values as any).birth_date)
</script>

<template>
  <GuestLayout>
    <Head title="Регистрация" />
    <h1 class="text-[22px] font-black tracking-tight text-ink-900 dark:text-white">Создай аккаунт</h1>
    <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Выбери район, радиус и стань частью живой карты</p>
    <form @submit.prevent="f.submit" class="mt-6 space-y-4">
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Имя / ник</label>
        <InputText v-model="f.name.value" v-bind="f.nameAttrs" placeholder="Роберт Дауни" class="w-full mt-1.5" :invalid="!!f.errors.value.name" />
        <small class="text-red-500 dark:text-red-400">{{ f.errors.value.name }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Email</label>
        <InputText v-model="f.email.value" v-bind="f.emailAttrs" type="email" placeholder="you@mail.ru" class="w-full mt-1.5" :invalid="!!f.errors.value.email" />
        <small class="text-red-500 dark:text-red-400">{{ f.errors.value.email }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Пол *</label>
        <Select v-model="f.gender.value" :options="g.options" optionLabel="label" optionValue="value" placeholder="Выбери пол" checkmark fluid class="w-full mt-1.5 !rounded-2xl" :invalid="!!f.errors.value.gender" />
        <small class="text-red-500 dark:text-red-400">{{ f.errors.value.gender }}</small>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Дата рождения</label>
          <DatePicker v-model="f.birth_date.value" dateFormat="yy-mm-dd" :maxDate="new Date()" showIcon fluid placeholder="1997-05-20" class="w-full mt-1.5" :invalid="!!f.errors.value.birth_date" />
          <small class="text-red-500 dark:text-red-400">{{ f.errors.value.birth_date }}</small>
          <small v-if="ageLabel" class="text-stone-500 dark:text-zinc-400">{{ ageLabel }}</small>
        </div>
        <div>
          <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Город проживания</label>
          <InputText v-model="f.home_city.value" placeholder="Минск" class="w-full mt-1.5" :invalid="!!f.errors.value.home_city" />
          <small class="text-red-500 dark:text-red-400">{{ f.errors.value.home_city }}</small>
        </div>
      </div>
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Страна проживания</label>
        <Select v-model="f.country.value" :options="[...RESIDENCE_COUNTRIES]" optionLabel="name" optionValue="name" placeholder="Беларусь" checkmark editable fluid class="w-full mt-1.5 !rounded-2xl" :invalid="!!f.errors.value.country" @update:model-value="(v:string)=>{ const c=[...RESIDENCE_COUNTRIES].find(x=>x.name===v); f.setValues({ country: v, country_code: c ? c.code : (f.values as any).country_code } as any) }" />
        <small class="text-stone-500 dark:text-zinc-400">Пины можно создавать только в своей стране</small>
        <small class="text-red-500 dark:text-red-400">{{ f.errors.value.country }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="f.password.value" v-bind="f.passwordAttrs" :type="f.showPass.value ? 'text' : 'password'" placeholder="••••••••" class="w-full pr-11" :invalid="!!f.errors.value.password" />
          <button type="button" @click="f.showPass.value=!f.showPass.value" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1">{{ f.showPass.value?'🙈':'👁' }}</button>
        </div>
        <small class="text-red-500 dark:text-red-400">{{ f.errors.value.password }}</small>
      </div>
      <div>
        <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Подтверди пароль</label>
        <div class="relative mt-1.5">
          <InputText v-model="f.password_confirmation.value" v-bind="f.passwordConfirmationAttrs" :type="f.showPass2.value ? 'text' : 'password'" placeholder="••••••••" class="w-full pr-11" :invalid="!!f.errors.value.password_confirmation" />
          <button type="button" @click="f.showPass2.value=!f.showPass2.value" class="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-stone-100 dark:hover:bg-white/10 grid place-items-center text-stone-500 dark:text-zinc-400 text-sm" tabindex="-1">{{ f.showPass2.value?'🙈':'👁' }}</button>
        </div>
        <small class="text-red-500 dark:text-red-400">{{ f.errors.value.password_confirmation }}</small>
      </div>
      <div class="bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 rounded-2xl p-3.5 space-y-2.5">
        <div class="flex items-center justify-between">
          <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Домашняя зона</label>
          <span class="text-[11px] font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-700 rounded-full px-2.5 py-1">{{ f.values.home_radius_km }} км · FREE до 5</span>
        </div>
        <p class="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">Выбери район где живёшь/бываешь — видишь чужие и свои пины в этом радиусе. Тот же радиус, что у пина.</p>
        <Button type="button" @click="f.detectLocation" :loading="f.locating.value" severity="secondary" outlined rounded class="w-full" :label="f.values.home_lat ? 'Обновить моё место' : 'Определить моё место'" icon="pi pi-map-marker" />
        <div v-if="f.values.home_address || f.addrLoading.value" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 flex items-center gap-2">
          <span class="w-7 h-7 rounded-full bg-ink-900 dark:bg-white dark:text-ink-900 text-white grid place-items-center shrink-0 text-[11px]">◉</span>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-semibold truncate dark:text-zinc-100">{{ f.addrLoading.value ? 'Определяем район…' : f.values.home_address }}</div>
            <div v-if="f.values.home_lat" class="text-[11px] text-stone-400 dark:text-zinc-400 font-mono">{{ f.values.home_lat }}, {{ f.values.home_lng }}</div>
          </div>
        </div>
        <HomeZoneField :model-value="Number(f.values.home_radius_km ?? 5)" plan="free" :error="f.errors.value.home_radius_km" @update:model-value="(v:number)=>f.setValues({ home_radius_km: v } as any)" />
        <p class="text-[11px] text-stone-500 dark:text-zinc-400">Больше радиус? Pro — до 15 км, Business — 20+ км. Сменишь после регистрации в тарифе.</p>
      </div>
      <Button :loading="f.isSubmitting.value" type="submit" label="Создать аккаунт →" class="w-full !bg-ink-900 dark:!bg-[#FAFAFA] !border-ink-900 dark:!border-[#FAFAFA] !text-white dark:!text-[#0F172A] !rounded-full !py-3.5 [&_.p-button-label]:!text-white dark:[&_.p-button-label]:!text-[#0F172A]" />
      <div class="text-sm text-center text-stone-500 dark:text-zinc-400">Уже есть? <Link :href="route('login')" class="font-semibold text-ink-900 dark:text-white hover:underline">Войти</Link></div>
    </form>
  </GuestLayout>
</template>
