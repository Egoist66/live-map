<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import DeleteUserForm from './Partials/DeleteUserForm.vue'
import UpdatePasswordForm from './Partials/UpdatePasswordForm.vue'
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm.vue'
import { Head, usePage } from '@inertiajs/vue3'
import { Link } from '@inertiajs/vue3'
import { ref, computed } from 'vue'
import { useTheme } from '@/composables/useTheme'
import AvatarPreview from '@/Components/AvatarPreview.vue'

defineProps<{ mustVerifyEmail: boolean; status: string; user: any }>()
const page = usePage()
const u = computed(() => (page.props.auth as any).user)
const { theme, setTheme } = useTheme()
const active = ref<'profile'|'privacy'|'appearance'|'security'>('profile')

const tabs = [
  { id:'profile', label:'Профиль', icon:'◉', desc:'Фото, имя, дом' },
  { id:'privacy', label:'Приватность', icon:'🔒', desc:'Анонимность, зона' },
  { id:'appearance', label:'Внешний вид', icon:'◐', desc:'Тема, карта' },
  { id:'security', label:'Безопасность', icon:'🛡', desc:'Пароль, удаление' },
] as const
const showAvatar = ref(false)
const avatarSrc = computed(() => u.value.avatar_path ? `/storage/${u.value.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(u.value.name)}&background=0F172A&color=fff&bold=true`)
</script>

<template>
  <Head title="Настройки — Live Map" />
  <AuthenticatedLayout>
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
      <div class="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
        <div class="bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 sm:p-7 flex flex-col sm:flex-row justify-between gap-4 relative overflow-hidden">
          <div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
          <div class="relative flex items-center gap-4 min-w-0">
            <button @click="showAvatar=true" class="group relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/20 shrink-0 focus:outline-none focus:ring-2 focus:ring-white/40">
              <img :src="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition duration-300"/>
              <span class="absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs">🔍</span>
            </button>
            <div class="min-w-0">
              <h1 class="text-xl font-black tracking-tight truncate">{{ u.name }} <span class="font-medium text-white/60 text-sm ml-2">{{ u.level || 'novice' }} · {{ u.reputation_score||0 }} ★</span></h1>
              <p class="text-white/60 text-sm mt-0.5 truncate">{{ u.email }} · <span class="capitalize">{{ u.plan||'free' }}</span> · {{ u.home_lat ? `дом ${Number(u.home_lat).toFixed(3)}, ${Number(u.home_lng).toFixed(3)}` : 'дом не задан' }}</p>
            </div>
          </div>
          <Link href="/map" class="relative bg-white text-ink-900 px-6 py-3 rounded-full font-bold h-fit hover:bg-stone-50 transition shrink-0 self-start sm:self-center">На карту →</Link>
        </div>

        <div class="mt-6 grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          <div class="lg:sticky lg:top-[80px] bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-2 shadow-soft">
            <div class="px-2 py-2 text-[11px] font-bold tracking-widest text-stone-400 uppercase">Настройки</div>
            <nav class="space-y-1">
              <button v-for="t in tabs" :key="t.id" @click="active=t.id" :class="['w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition', active===t.id ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 shadow-soft' : 'hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300']">
                <span class="w-9 h-9 rounded-xl grid place-items-center text-sm" :class="active===t.id ? 'bg-white/15 dark:bg-ink-900/10' : 'bg-stone-100 dark:bg-zinc-800'">{{ t.icon }}</span>
                <div class="min-w-0"><div class="text-sm font-semibold leading-none">{{ t.label }}</div><div class="text-xs opacity-60 leading-none mt-1">{{ t.desc }}</div></div>
                <span v-if="active===t.id" class="ml-auto text-xs">→</span>
              </button>
            </nav>
            <div class="mt-4 mx-2 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
              <div class="text-xs font-bold">Подписка {{ u.plan||'free' }}</div>
              <div class="text-xs text-stone-600 dark:text-zinc-400 mt-1">{{ u.pins_today_count||0 }}/{{ u.plan==='free'?3:'∞' }} пинов сегодня</div>
              <Link href="/profile" class="text-xs font-semibold underline mt-2 inline-block">Управление →</Link>
            </div>
          </div>

          <div class="space-y-4 min-w-0">
            <div v-show="active==='profile'" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover">
              <h3 class="font-black tracking-tight text-lg">Профиль</h3>
              <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Фото, имя и домашняя зона — на них строится весь Live Map.</p>
              <UpdateProfileInformationForm :must-verify-email="mustVerifyEmail" :status="status" class="mt-5 max-w-xl" />
            </div>

            <div v-show="active==='privacy'" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover">
              <h3 class="font-black tracking-tight text-lg">Приватность</h3>
              <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Ты — не точка, ты — пин. Управляй размытием и анонимностью.</p>
              <div class="mt-5 space-y-4 max-w-xl">
                <div class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4">
                  <div class="text-sm font-semibold">Базовые принципы</div>
                  <ul class="text-sm text-stone-600 dark:text-zinc-400 mt-2 space-y-1 list-disc pl-5">
                    <li>Размытие 200м по умолчанию — координаты смещаются случайно</li>
                    <li>Анонимный пин скрывает имя и репутацию</li>
                    <li>Блокировка в 1 клик скрывает контент пользователя</li>
                  </ul>
                </div>
                <div class="border border-stone-200 dark:border-zinc-700 rounded-2xl p-4">
                  <div class="text-sm font-semibold">Режим анонимности по умолчанию</div>
                  <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">Настраивается в разделе «Профиль» — переключатель «Анонимно по умолчанию». При создании пина можно переопределить.</p>
                  <button @click="active='profile'" class="mt-3 text-xs font-semibold bg-ink-900 dark:bg-white dark:text-ink-900 text-white px-4 py-2 rounded-full">Перейти в Профиль →</button>
                </div>
              </div>
            </div>

            <div v-show="active==='appearance'" class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover">
              <h3 class="font-black tracking-tight text-lg">Внешний вид</h3>
              <p class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Тема оформления и отображение карты.</p>
              <div class="mt-6 space-y-5 max-w-xl">
                <div>
                  <div class="text-sm font-semibold">Тема</div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400">Выбери как выглядит Live Map на этом устройстве</div>
                  <div class="mt-3 grid grid-cols-3 gap-2">
                    <button @click="setTheme('light')" :class="['rounded-2xl border p-3 flex flex-col items-center gap-2 transition', theme==='light' ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50']">
                      <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 grid place-items-center text-sm">☀️</span>
                      <span class="text-xs font-semibold">Светлая</span>
                    </button>
                    <button @click="setTheme('dark')" :class="['rounded-2xl border p-3 flex flex-col items-center gap-2 transition', theme==='dark' ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50']">
                      <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 grid place-items-center text-sm text-white">🌙</span>
                      <span class="text-xs font-semibold">Тёмная</span>
                    </button>
                    <button @click="setTheme('system')" :class="['rounded-2xl border p-3 flex flex-col items-center gap-2 transition', theme==='system' ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 shadow-soft' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 hover:bg-stone-50']">
                      <span class="w-10 h-10 rounded-xl bg-gradient-to-br from-stone-100 to-zinc-800 grid place-items-center text-sm">◐</span>
                      <span class="text-xs font-semibold">Система</span>
                    </button>
                  </div>
                  <div class="text-[11px] text-stone-400 mt-2">Система = следует настройкам OS (prefers-color-scheme)</div>
                </div>

                <div class="bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4">
                  <div class="text-sm font-semibold">Карта в тёмной теме</div>
                  <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">При тёмной теме карта переключается на <b>dark-matter</b>, при светлой — OSM/positron. Переключение мгновенное.</p>
                </div>
              </div>
            </div>

            <div v-show="active==='security'" class="space-y-4">
              <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover"><UpdatePasswordForm class="max-w-xl" /></div>
              <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft card-hover"><DeleteUserForm class="max-w-xl" /></div>
            </div>
          </div>
        </div>
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="showAvatar=false" />
    </div>
  </AuthenticatedLayout>
</template>

<style scoped>
.privacy-only :deep(form) { display: contents; }
</style>
