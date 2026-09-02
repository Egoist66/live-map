<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed, ref, onMounted } from 'vue'
import AvatarPreview from '@/Components/AvatarPreview.vue'
import { useBadgeStore } from '@/stores/badges'

const props = defineProps<{ user: any; isOwn?: boolean }>()
const page = usePage()
const auth = (page.props.auth as any).user
const u = computed(() => props.user || auth)
const isOwn = computed(() => props.isOwn ?? u.value.id === auth.id)
const showAvatar = ref(false)
const avatarSrc = computed(() => u.value.avatar_path ? `/storage/${u.value.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.value.name)}&background=0F172A&color=fff&bold=true`)
const levelLabel: Record<string,string> = { novice:'Новичок', explorer:'Исследователь', local:'Местный', veteran:'Ветеран', guide:'Гид района' }
const levelColor: Record<string,string> = { novice:'bg-stone-100 text-stone-700 border-stone-200', explorer:'bg-sky-50 text-sky-700 border-sky-200', local:'bg-emerald-50 text-emerald-700 border-emerald-200', veteran:'bg-violet-50 text-violet-700 border-violet-200', guide:'bg-amber-50 text-amber-700 border-amber-200' }
const planLabel: Record<string,string> = { free:'Free', pro:'Pro', business:'Business' }
const planColor: Record<string,string> = { free:'bg-stone-100 text-stone-700 border-stone-200', pro:'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-transparent', business:'bg-ink-900 text-white border-ink-900' }
const settingsHref = computed(() => isOwn.value ? route('profile.edit', { identifier: auth.is_admin || auth.role==='admin' ? 'admin' : String(auth.id) }) : route('profile.edit', { identifier: String(u.value.id) }))
const badges = useBadgeStore()
onMounted(()=> { if(isOwn.value) badges.init() })
</script>

<template>
  <Head title="Профиль" />
  <AuthenticatedLayout>
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
      <div class="max-w-[980px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div class="bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 sm:p-8 relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
          <div class="absolute -right-10 bottom-0 w-64 h-64 bg-white rounded-full blur-[80px] opacity-[0.05]"></div>
          <div class="relative flex flex-col sm:flex-row gap-6">
            <button @click="showAvatar=true" class="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-[20px] overflow-hidden border-2 border-white/20 shrink-0 focus:outline-none focus:ring-2 focus:ring-white/40 bg-white/10">
              <img :src="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              <span class="absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs font-semibold">Просмотр</span>
            </button>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-[22px] sm:text-[26px] font-black tracking-tight leading-none">{{ u.name }}</h1>
                <span v-if="u.is_admin || u.role==='admin'" class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-ink-900">ADMIN</span>
              </div>
              <p class="text-white/60 text-sm mt-2 truncate">{{ u.email }}</p>
              <p class="text-white/40 text-xs mt-1.5 flex flex-wrap items-center gap-2">
                <span :class="['px-2 py-1 rounded-full text-xs font-bold border', levelColor[u.level||'novice'] || levelColor.novice]">{{ levelLabel[u.level] || u.level || 'Новичок' }}</span>
                <span class="opacity-80">· {{ (u.reputation_score||0) }} ★</span>
                <span :class="['px-2 py-1 rounded-full text-xs font-bold border', planColor[u.plan||'free']]">{{ planLabel[u.plan||'free'] || u.plan }}</span>
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <Link href="/map" class="bg-white text-ink-900 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-stone-50 transition inline-flex items-center gap-2">Открыть карту →</Link>
                <Link v-if="isOwn" :href="settingsHref" class="bg-white/10 border border-white/15 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-white/15 transition">Настройки</Link>
                <Link v-if="isOwn" href="/chat" class="relative bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-bold hover:opacity-90 transition inline-flex items-center gap-2">Чат
                  <span v-if="badges.unread" class="bg-white text-violet-700 text-xs font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{{ badges.unread }}</span>
                  <span v-if="badges.pending" class="bg-amber-400 text-ink-900 text-xs font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{{ badges.pending }}</span>
                </Link>
              </div>
              <div v-if="isOwn && badges.total" class="mt-3 flex gap-2 text-xs font-semibold">
                <span v-if="badges.unread" class="inline-flex items-center gap-1 bg-red-500 text-white px-2.5 py-1 rounded-full">✉ {{ badges.unread }} непроч.</span>
                <span v-if="badges.pending" class="inline-flex items-center gap-1 bg-amber-500 text-white px-2.5 py-1 rounded-full">👥 {{ badges.pending }} заявок</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
          <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
            <h3 class="font-black tracking-tight">Общая информация</h3>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex justify-between gap-4 py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Имя</span><span class="font-semibold dark:text-white">{{ u.name }}</span></div>
              <div class="flex justify-between gap-4 py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Email</span><span class="font-semibold dark:text-white truncate max-w-[60%]">{{ u.email }}</span></div>
              <div class="flex justify-between gap-4 py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Уровень</span><span class="font-semibold dark:text-white">{{ levelLabel[u.level] || u.level || 'novice' }}</span></div>
              <div class="flex justify-between gap-4 py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Репутация</span><span class="font-semibold dark:text-white">{{ u.reputation_score||0 }}</span></div>
              <div class="flex justify-between gap-4 py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Тариф</span><span class="font-semibold capitalize dark:text-white">{{ u.plan || 'free' }}</span></div>
              <div class="flex justify-between gap-4 py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Дом</span><span class="font-semibold dark:text-white text-right">{{ u.home_lat && u.home_lng ? `${Number(u.home_lat).toFixed(4)}, ${Number(u.home_lng).toFixed(4)} · ${u.home_radius_km||2} км` : 'не задан' }}</span></div>
              <div class="flex justify-between gap-4 py-2.5"><span class="text-stone-500 dark:text-zinc-400">Анонимность</span><span class="font-semibold dark:text-white">{{ u.is_anonymous_default ? 'включена по умолчанию' : 'выключена' }}</span></div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
              <h3 class="font-black tracking-tight">Действия</h3>
              <Link v-if="isOwn && badges.total" href="/chat" class="mt-3 flex items-center justify-between p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition">
                <span class="text-sm font-bold dark:text-white">Новые уведомления</span>
                <span class="flex gap-1"><span v-if="badges.unread" class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{{ badges.unread }} ✉</span><span v-if="badges.pending" class="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">{{ badges.pending }} 👥</span></span>
              </Link>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <Link href="/map" class="bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-[16px] p-4 flex flex-col gap-1 hover:opacity-90 transition"><span class="w-8 h-8 rounded-xl bg-white/15 dark:bg-ink-900/10 grid place-items-center text-sm">🗺️</span><span class="text-sm font-bold leading-tight">Карта</span><span class="text-[11px] opacity-60">пины рядом</span></Link>
                <Link v-if="isOwn" :href="settingsHref" class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-[16px] p-4 flex flex-col gap-1 hover:bg-white dark:hover:bg-zinc-700 transition"><span class="w-8 h-8 rounded-xl bg-white dark:bg-zinc-700 border dark:border-zinc-600 grid place-items-center text-sm">⚙️</span><span class="text-sm font-bold leading-tight dark:text-white">Настройки</span><span class="text-[11px] text-stone-500 dark:text-zinc-400">тариф и прочее</span></Link>
                <Link href="/map" class="bg-gradient-to-br from-brand-500 to-accent-teal text-white rounded-[16px] p-4 flex flex-col gap-1 hover:opacity-90 transition"><span class="w-8 h-8 rounded-xl bg-white/20 grid place-items-center">＋</span><span class="text-sm font-bold leading-tight">Новый пин</span><span class="text-[11px] opacity-80">в 2 клика</span></Link>
                <Link href="/faq" class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-[16px] p-4 flex flex-col gap-1 hover:bg-white transition"><span class="w-8 h-8 rounded-xl bg-white dark:bg-zinc-700 border grid place-items-center text-sm">?</span><span class="text-sm font-bold leading-tight dark:text-white">FAQ</span><span class="text-[11px] text-stone-500">как это работает</span></Link>
              </div>
              <p class="text-xs text-stone-500 dark:text-zinc-400 mt-4 leading-relaxed">Ты — не точка, ты — пин. Размытие 200м, анонимные пины и блок в 1 клик.</p>
            </div>
            <div v-if="isOwn" class="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-[20px] p-5">
              <div class="text-sm font-black">Нужна помощь?</div>
              <p class="text-xs text-stone-600 dark:text-zinc-400 mt-1">Напиши в поддержку или задонать проекту — всё в настройках.</p>
              <Link :href="settingsHref" class="mt-3 inline-flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full text-xs font-bold hover:opacity-90">Перейти в настройки →</Link>
            </div>
          </div>
        </div>
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="showAvatar=false" />
    </div>
  </AuthenticatedLayout>
</template>
