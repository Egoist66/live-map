<script setup lang="ts">
import InputError from '@/Components/InputError.vue'
import PrimaryButton from '@/Components/PrimaryButton.vue'
import { Link, useForm, usePage, router } from '@inertiajs/vue3'
import { ref, computed, watch } from 'vue'
import AvatarPreview from '@/Components/AvatarPreview.vue'

defineProps<{ mustVerifyEmail: boolean; status: string }>()

const page = usePage()
const user = computed(() => (page.props.auth as any).user)

const form = useForm({
  name: user.value.name,
  email: user.value.email,
  home_lat: user.value.home_lat || '',
  home_lng: user.value.home_lng || '',
  home_radius_km: user.value.home_radius_km || 2,
  is_anonymous_default: !!user.value.is_anonymous_default,
  plan: user.value.plan || 'free',
})
watch(user, (u) => { form.name = u.name; form.email = u.email; form.home_lat = u.home_lat || ''; form.home_lng = u.home_lng || ''; form.home_radius_km = u.home_radius_km || 2; form.is_anonymous_default = !!u.is_anonymous_default; form.plan = u.plan || 'free' })

const avatarFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const uploading = ref(false)
const avatarOk = ref(false)

function onAvatar(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  avatarFile.value = f
  const r = new FileReader()
  r.onload = () => previewUrl.value = r.result as string
  r.readAsDataURL(f)
}
function uploadAvatar() {
  if (!avatarFile.value) return
  uploading.value = true
  const fd = new FormData()
  fd.append('avatar', avatarFile.value)
  router.post(route('profile.avatar'), fd, {
    forceFormData: true,
    preserveScroll: true,
    onSuccess: () => {
      avatarFile.value = null
      previewUrl.value = null
      avatarOk.value = true
      router.reload({ only: ['auth'] })
      setTimeout(()=> avatarOk.value = false, 2500)
    },
    onFinish: () => uploading.value = false,
  })
}

function useMyLocation() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition((pos) => {
    form.home_lat = Number(pos.coords.latitude.toFixed(7))
    form.home_lng = Number(pos.coords.longitude.toFixed(7))
  })
}

const showPreview = ref(false)
const avatarSrc = computed(() => {
  if (previewUrl.value) return previewUrl.value
  if (user.value.avatar_path) return `/storage/${user.value.avatar_path}`
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.value.name)}&background=0F172A&color=fff&bold=true`
})
</script>

<template>
  <section>
    <header>
      <h2 class="font-bold">Профиль и приватность</h2>
      <p class="text-sm text-zinc-500 mt-1">Имя, почта, домашняя зона и режим анонимности по умолчанию.</p>
    </header>

    <div class="flex flex-col sm:flex-row items-start gap-5 mt-6 p-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl">
      <div class="relative shrink-0">
        <button @click="showPreview=true" class="group relative w-20 h-20 rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-700 bg-stone-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
          <img :src="avatarSrc" :key="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
          <span class="absolute inset-0 bg-black/0 group-hover:bg-black/25 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-[10px] font-bold">🔍 превью</span>
        </button>
        <span v-if="avatarOk" class="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[11px] px-1.5 py-0.5 rounded-full">✓</span>
      </div>
      <div class="flex-1 min-w-0 w-full">
        <label class="text-sm font-semibold">Фото профиля</label>
        <p class="text-xs text-zinc-500">JPG/PNG/WebP до 2МБ · сразу видно везде</p>
        <div class="flex gap-2 mt-3">
          <label class="flex-1 cursor-pointer">
            <input type="file" accept="image/*" @change="onAvatar" class="hidden" />
            <span class="block text-sm border border-stone-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 bg-stone-50 dark:bg-zinc-800 hover:bg-stone-100 text-stone-600 dark:text-zinc-300 truncate">{{ avatarFile ? avatarFile.name : 'Выбери файл…' }}</span>
          </label>
          <button type="button" @click="uploadAvatar" :disabled="!avatarFile || uploading" class="bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40 shrink-0 flex items-center gap-2">
            <span v-if="uploading" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            {{ uploading ? 'Загрузка…' : 'Загрузить' }}
          </button>
        </div>
        <div v-if="avatarOk" class="text-xs text-emerald-600 mt-1.5">✓ Фото обновлено — видно в шапке и на пинах</div>
      </div>
    </div>

    <form @submit.prevent="form.patch(route('profile.update'))" class="mt-6 space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="text-sm font-medium">Имя</label><input v-model="form.name" type="text" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700" required/><InputError :message="form.errors.name" class="mt-1"/></div>
        <div><label class="text-sm font-medium">Email</label><input v-model="form.email" type="email" class="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700" required/><InputError :message="form.errors.email" class="mt-1"/></div>
      </div>

      <div class="bg-zinc-50 dark:bg-zinc-900 border rounded-xl p-4 space-y-3">
        <div class="flex items-center justify-between"><h4 class="text-sm font-bold">Домашняя зона</h4><button type="button" @click="useMyLocation" class="text-xs bg-black dark:bg-white dark:text-black text-white px-3 py-1 rounded-full">Моя геопозиция</button></div>
        <div class="grid sm:grid-cols-3 gap-3">
          <div><label class="text-xs font-medium">Широта</label><input v-model="form.home_lat" placeholder="55.75" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"/><InputError :message="form.errors.home_lat" class="mt-1"/></div>
          <div><label class="text-xs font-medium">Долгота</label><input v-model="form.home_lng" placeholder="37.61" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"/><InputError :message="form.errors.home_lng" class="mt-1"/></div>
          <div><label class="text-xs font-medium">Радиус км</label><input v-model.number="form.home_radius_km" type="number" min="1" max="20" class="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700"/><InputError :message="form.errors.home_radius_km" class="mt-1"/></div>
        </div>
        <p class="text-[11px] text-zinc-500">Не точный адрес — только зона интереса. Используется для уведомлений о пинах рядом.</p>
      </div>

      <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="form.is_anonymous_default" class="rounded"/> Создавать пины анонимно по умолчанию (без репутации)</label>

      <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4">
        <h4 class="text-sm font-black">Тариф — {{ ({free:'Бесплатный',pro:'Pro',business:'Бизнес'} as any)[form.plan] }}</h4>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Переключи тариф — вступают сразу. Оплата пока в демо-режиме.</p>
        <div class="mt-3 grid sm:grid-cols-3 gap-2">
          <button type="button" @click="form.plan='free'" :class="['rounded-2xl border p-3 text-left transition', form.plan==='free'?'bg-ink-900 dark:bg-white dark:text-ink-900 text-white border-ink-900 dark:border-white shadow-soft':'bg-stone-50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700 border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100']">
            <div class="text-sm font-bold">Free</div><div class="text-xs opacity-70">3/день · 1км · 2ч</div><div class="text-xs font-bold mt-1">Бесплатно</div>
          </button>
          <button type="button" @click="form.plan='pro'" :class="['rounded-2xl border p-3 text-left transition relative overflow-hidden', form.plan==='pro'?'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-600 shadow-lg dark:from-violet-500 dark:to-indigo-500':'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-stone-900 dark:text-amber-100']">
            <span v-if="form.plan==='pro'" class="absolute top-2 right-2 text-[10px] bg-white/20 rounded-full px-2 py-0.5">выбран</span>
            <div class="text-sm font-black">Pro</div><div class="text-xs opacity-80">Безлимит · 5км · 24ч</div><div class="text-xs font-bold mt-1">$4.99 / мес</div>
          </button>
          <button type="button" @click="form.plan='business'" :class="['rounded-2xl border p-3 text-left transition', form.plan==='business'?'bg-ink-900 dark:bg-white dark:text-ink-900 text-white border-ink-900 dark:border-white shadow-soft':'bg-stone-50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700 border-stone-200 dark:border-zinc-700 text-stone-900 dark:text-zinc-100']">
            <div class="text-sm font-bold">Business</div><div class="text-xs opacity-70">Безлимит · 50км · 168ч</div><div class="text-xs font-bold mt-1">$19.99 / мес</div>
          </button>
        </div>
        <InputError :message="form.errors.plan" class="mt-2"/>
      </div>

      <div v-if="mustVerifyEmail && user.email_verified_at === null" class="text-sm bg-amber-50 border border-amber-200 rounded-xl p-3">
        Почта не подтверждена. <Link :href="route('verification.send')" method="post" as="button" class="underline font-medium">Отправить письмо</Link>
        <div v-if="status==='verification-link-sent'" class="text-green-700 mt-1">Письмо отправлено</div>
      </div>

      <div class="flex items-center gap-3">
        <PrimaryButton :disabled="form.processing" class="!bg-black dark:!bg-white dark:!text-ink-900 !rounded-full">Сохранить</PrimaryButton>
        <span v-if="form.recentlySuccessful" class="text-sm text-green-600">Сохранено</span>
      </div>
    </form>
    <AvatarPreview :src="avatarSrc" :name="user.name" :open="showPreview" @close="showPreview=false" />
  </section>
</template>
