<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed, ref, onMounted } from 'vue'
import AvatarPreview from '@/Components/AvatarPreview.vue'
import { useBadgeStore } from '@/stores/badges'
import { useSanitizedBio } from '@/composables/useSanitizedBio'

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
const bio = useSanitizedBio(() => u.value.bio)
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
          <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[24px] p-6 shadow-soft overflow-hidden relative">
            <div class="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-full blur-2xl"></div>
            <div class="relative flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center text-sm shadow-soft">◎</div>
                <div>
                  <h3 class="font-black tracking-tight leading-none">Общая информация</h3>
                  <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Профиль · видимость · приватность</p>
                </div>
              </div>

            </div>

            <div class="mt-5 grid gap-2.5">
              <div class="group flex items-center gap-3 p-3 rounded-2xl bg-stone-50/80 dark:bg-zinc-800/60 border border-stone-100 dark:border-zinc-700/60 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-soft transition">
                <div class="w-9 h-9 rounded-xl bg-white dark:bg-zinc-700 border border-stone-200 dark:border-zinc-600 grid place-items-center text-sm shrink-0">👤</div>
                <div class="min-w-0 flex-1">
                  <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Имя</div>
                  <div class="text-sm font-bold dark:text-white truncate">{{ u.name }}</div>
                </div>
                <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] shrink-0"></span>
              </div>

              <div class="group flex items-center gap-3 p-3 rounded-2xl bg-stone-50/80 dark:bg-zinc-800/60 border border-stone-100 dark:border-zinc-700/60 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-soft transition">
                <div class="w-9 h-9 rounded-xl bg-white dark:bg-zinc-700 border border-stone-200 dark:border-zinc-600 grid place-items-center text-sm shrink-0">✉️</div>
                <div class="min-w-0 flex-1">
                  <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Email</div>
                  <div class="text-sm font-semibold dark:text-white truncate">{{ u.email }}</div>
                </div>
                <span v-if="u.email_verified_at" class="text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-full shrink-0">✓ Подтверждена</span>
                <span v-else class="text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-1 rounded-full shrink-0">не подтверждён</span>
              </div>

              <div class="p-3.5 rounded-2xl bg-stone-50/80 dark:bg-zinc-800/60 border border-stone-100 dark:border-zinc-700/60">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-white dark:bg-zinc-700 border border-stone-200 dark:border-zinc-600 grid place-items-center text-xs shrink-0">✨</div>
                  <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">О себе</div>
                  <Link v-if="isOwn" :href="settingsHref" class="ml-auto text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline">изменить</Link>
                </div>
                <div v-if="!bio.isEmpty.value" class="mt-2.5 prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-h2:text-[15px] prose-h2:font-black prose-h2:mt-3 prose-h2:mb-1 prose-h3:text-[13px] prose-h3:font-bold prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-a:underline prose-ul:list-disc prose-ul:pl-5 prose-ul:my-1.5 prose-ol:list-decimal prose-ol:pl-5 prose-blockquote:border-l-2 prose-blockquote:border-violet-300 dark:prose-blockquote:border-violet-700 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-stone-600 dark:prose-blockquote:text-zinc-400 prose-code:bg-white dark:prose-code:bg-zinc-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-ink-900 prose-pre:text-white dark:prose-pre:bg-zinc-900 leading-relaxed text-stone-700 dark:text-zinc-300" v-html="bio.html.value"></div>
                <div v-else class="mt-2 text-sm leading-relaxed" :class="isOwn ? 'text-stone-500 dark:text-zinc-400' : 'text-stone-500 dark:text-zinc-400'">{{ isOwn ? 'Расскажи о себе — это видят другие на твоём профиле. Добавь в настройках.' : 'Пользователь пока ничего не рассказал о себе.' }}</div>
              </div>

              <div class="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-teal-50/70 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/40 hover:shadow-soft transition">
                <div class="w-9 h-9 rounded-xl bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 grid place-items-center text-sm shrink-0">📍</div>
                <div class="min-w-0 flex-1">
                  <div class="text-[10px] font-bold tracking-widest uppercase text-emerald-700/60 dark:text-emerald-300/60">Домашняя зона</div>
                  <div class="text-sm font-bold dark:text-white truncate">{{ u.home_lat && u.home_lng ? `${Number(u.home_lat).toFixed(4)}, ${Number(u.home_lng).toFixed(4)}` : 'не задана' }}</div>
                </div>
                <span class="shrink-0 text-xs font-black px-3 py-1.5 rounded-full bg-ink-900 text-white dark:bg-white dark:text-ink-900">{{ u.home_radius_km||2 }} км</span>
              </div>

              <div class="flex items-center gap-3 p-3 rounded-2xl border transition" :class="u.is_anonymous_default ? 'bg-violet-50/70 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/50' : 'bg-stone-50/80 dark:bg-zinc-800/60 border-stone-100 dark:border-zinc-700/60'">
                <div class="w-9 h-9 rounded-xl grid place-items-center text-sm shrink-0 border" :class="u.is_anonymous_default ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-700 border-stone-200 dark:border-zinc-600'">{{ u.is_anonymous_default ? '🕶️' : '👁️' }}</div>
                <div class="min-w-0 flex-1">
                  <div class="text-[10px] font-bold tracking-widest uppercase" :class="u.is_anonymous_default ? 'text-violet-600 dark:text-violet-300' : 'text-stone-400 dark:text-zinc-500'">Анонимность</div>
                  <div class="text-sm font-bold dark:text-white leading-none">{{ u.is_anonymous_default ? 'Включена по умолчанию' : 'Выключена' }}</div>
                  <div class="text-[11px] mt-0.5" :class="u.is_anonymous_default ? 'text-violet-600/70 dark:text-violet-300/70' : 'text-stone-500 dark:text-zinc-400'">пины скрывают автора</div>
                </div>
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="u.is_anonymous_default ? 'bg-violet-600 shadow-[0_0_0_4px_rgba(124,58,237,0.15)]' : 'bg-stone-300 dark:bg-zinc-600'"></span>
              </div>
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
