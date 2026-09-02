<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import AvatarPreview from '@/Components/AvatarPreview.vue'
import { useProfileForm } from '@/composables/useProfileForm'
import { useAvatarUpload } from '@/composables/useAvatarUpload'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'

defineProps<{ mustVerifyEmail: boolean; status: string }>()
const f = useProfileForm()
const a = useAvatarUpload()
</script>

<template>
  <section>
    <header>
      <h2 class="font-bold">Профиль и приватность</h2>
      <p class="text-sm text-zinc-500 mt-1">Имя, почта, домашняя зона и режим анонимности по умолчанию.</p>
    </header>

    <div class="flex flex-col sm:flex-row items-start gap-5 mt-6 p-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl">
      <div class="relative shrink-0">
        <button @click="a.showPreview.value=true" class="group relative w-20 h-20 rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 bg-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
          <img :src="a.avatarSrc.value" :key="a.avatarSrc.value" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
          <span class="absolute inset-0 bg-black/0 group-hover:bg-black/25 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">🔍 превью</span>
        </button>
        <span v-if="a.avatarOk.value" class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">✓</span>
      </div>
      <div class="flex-1 min-w-0 w-full">
        <label class="text-sm font-semibold">Фото профиля</label>
        <p class="text-xs text-zinc-500">JPG/PNG/WebP до 2МБ · сразу видно везде</p>
        <div class="flex gap-2 mt-3">
          <label class="flex-1 cursor-pointer">
            <input type="file" accept="image/*" @change="a.onAvatar" class="hidden" />
            <span class="block text-sm border border-stone-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 bg-stone-50 dark:bg-zinc-800 hover:bg-stone-100 text-stone-600 dark:text-zinc-300 truncate">{{ a.avatarFile.value ? a.avatarFile.value.name : 'Выбери файл…' }}</span>
          </label>
          <Button @click="a.uploadAvatar" :disabled="!a.avatarFile.value || a.uploading.value" :loading="a.uploading.value" label="Загрузить" rounded class="!bg-ink-900 !border-ink-900 dark:!bg-white dark:!border-white dark:!text-ink-900 shrink-0" />
        </div>
        <div v-if="a.avatarOk.value" class="text-xs text-emerald-600 mt-1.5">✓ Фото обновлено — видно в шапке и на пинах</div>
      </div>
    </div>

    <form @submit.prevent="f.submit" class="mt-6 space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-sm font-medium">Имя</label><InputText v-model="f.name.value" v-bind="f.nameAttrs" class="w-full mt-1" :invalid="!!f.errors.value.name" /><small class="text-red-500">{{ f.errors.value.name }}</small></div>
        <div><label class="text-sm font-medium">Email</label><InputText v-model="f.email.value" v-bind="f.emailAttrs" type="email" class="w-full mt-1" :invalid="!!f.errors.value.email" /><small class="text-red-500">{{ f.errors.value.email }}</small></div>
      </div>

      <div class="bg-zinc-50 dark:bg-zinc-900 border rounded-xl p-4 space-y-3">
        <div class="flex items-center justify-between"><h4 class="text-sm font-bold">Домашняя зона</h4><Button @click="f.useMyLocation" label="Моя геопозиция" size="small" rounded class="!bg-black !border-black !text-white dark:!bg-white dark:!text-black" /></div>
        <div class="grid sm:grid-cols-3 gap-3">
          <div><label class="text-xs font-medium">Широта</label><InputText v-model="f.home_lat.value" v-bind="f.homeLatAttrs" placeholder="55.75" class="w-full mt-1" :invalid="!!f.errors.value.home_lat" /><small class="text-red-500">{{ f.errors.value.home_lat }}</small></div>
          <div><label class="text-xs font-medium">Долгота</label><InputText v-model="f.home_lng.value" v-bind="f.homeLngAttrs" placeholder="37.61" class="w-full mt-1" :invalid="!!f.errors.value.home_lng" /><small class="text-red-500">{{ f.errors.value.home_lng }}</small></div>
          <div><label class="text-xs font-medium">Радиус км</label><InputText v-model.number="f.values.home_radius_km" type="number" class="w-full mt-1" /><small class="text-red-500">{{ f.errors.value.home_radius_km }}</small></div>
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm"><Checkbox v-model="f.is_anonymous_default.value" :binary="true" /> Создавать пины анонимно по умолчанию</label>

      <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4">
        <h4 class="text-sm font-black">Тариф — {{ ({free:'Бесплатный',pro:'Pro',business:'Бизнес'} as any)[f.values.plan] }}</h4>
        <p class="text-xs text-zinc-500 mt-1">Переключи тариф — вступают сразу.</p>
        <div class="mt-3 grid sm:grid-cols-3 gap-2">
          <button type="button" @click="(f.plan.value as any)='free'" :class="['rounded-2xl border p-3 text-left transition', f.values.plan==='free'?'bg-ink-900 text-white border-ink-900':'bg-stone-50 border-stone-200']">
            <div class="text-sm font-bold">Free</div><div class="text-xs opacity-70">3/день · 1км · 2ч</div><div class="text-xs font-bold mt-1">Бесплатно</div>
          </button>
          <button type="button" @click="(f.plan.value as any)='pro'" :class="['rounded-2xl border p-3 text-left transition', f.values.plan==='pro'?'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-600':'bg-amber-50 border-amber-200']">
            <div class="text-sm font-black">Pro</div><div class="text-xs opacity-80">Безлимит · 5км · 24ч</div><div class="text-xs font-bold mt-1">$4.99 / мес</div>
          </button>
          <button type="button" @click="(f.plan.value as any)='business'" :class="['rounded-2xl border p-3 text-left transition', f.values.plan==='business'?'bg-ink-900 text-white border-ink-900':'bg-stone-50 border-stone-200']">
            <div class="text-sm font-bold">Business</div><div class="text-xs opacity-70">Безлимит · 50км · 168ч</div><div class="text-xs font-bold mt-1">$19.99 / мес</div>
          </button>
        </div>
      </div>

      <div v-if="mustVerifyEmail && f.user.value.email_verified_at === null" class="text-sm bg-amber-50 border border-amber-200 rounded-xl p-3">
        Почта не подтверждена. <Link :href="route('verification.send')" method="post" as="button" class="underline font-medium">Отправить письмо</Link>
        <div v-if="status==='verification-link-sent'" class="text-green-700 mt-1">Письмо отправлено</div>
      </div>

      <div class="flex items-center gap-3">
        <Button :loading="f.isSubmitting.value" type="submit" label="Сохранить" rounded class="!bg-black dark:!bg-white dark:!text-ink-900" />
      </div>
    </form>
    <AvatarPreview :src="a.avatarSrc.value" :name="f.user.value.name" :open="a.showPreview.value" @close="a.showPreview.value=false" />
  </section>
</template>
