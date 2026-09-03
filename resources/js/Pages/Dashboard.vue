<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link, usePage, router } from '@inertiajs/vue3'
import { computed, ref, onMounted } from 'vue'
import AvatarPreview from '@/Components/AvatarPreview.vue'
import { useBadgeStore } from '@/stores/badges'
import { useSeo } from '@/composables/useSeo'
import { avatarSrcFor } from '@/composables/useAvatar'
import Card from 'primevue/card'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Toast from 'primevue/toast'
import { useProfileShare } from '@/composables/useProfileShare'
const seo = useSeo({ title: 'Профиль', description: 'Профиль UPin', noindex: true })
const props = defineProps<{ user: any; isOwn?: boolean }>()
const page = usePage()
const auth = (page.props.auth as any).user
const u = computed(() => props.user || auth)
const isOwn = computed(() => props.isOwn ?? u.value.id === auth.id)
const showAvatar = ref(false)
const avatarSrc = computed(() => avatarSrcFor(u.value))
const levelLabel: Record<string,string> = { novice:'Новичок', explorer:'Исследователь', local:'Местный', veteran:'Ветеран', guide:'Гид района' }
const levelColor: Record<string,string> = { novice:'!bg-stone-100 !text-stone-700 !border-stone-200', explorer:'!bg-sky-50 !text-sky-700 !border-sky-200', local:'!bg-emerald-50 !text-emerald-700 !border-emerald-200', veteran:'!bg-violet-50 !text-violet-700 !border-violet-200', guide:'!bg-amber-50 !text-amber-700 !border-amber-200' }
const planLabel: Record<string,string> = { free:'Free', pro:'Pro', business:'Business' }
const planColor: Record<string,string> = { free:'!bg-stone-100 !text-stone-700 !border-stone-200', pro:'!bg-gradient-to-br !from-violet-600 !to-indigo-600 !text-white !border-transparent', business:'!bg-ink-900 !text-white !border-ink-900' }
const settingsHref = computed(() => isOwn.value ? route('profile.edit', { identifier: auth.is_admin || auth.role==='admin' ? 'admin' : String(auth.id) }) : route('profile.edit', { identifier: String(u.value.id) }))
const badges = useBadgeStore()
const bioText = computed(() => (u.value.bio || '').trim())
const bioEmpty = computed(() => bioText.value.length === 0)
const { shareProfile, sharing } = useProfileShare()
onMounted(()=> { if(isOwn.value) badges.init() })
</script>
<template>
  <Head :title="seo.title.value"><meta head-key="robots" name="robots" content="noindex, nofollow" /></Head>
  <AuthenticatedLayout>
    <Toast />
    <div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)] overflow-x-hidden">
      <div class="max-w-[980px] mx-auto w-full max-w-full min-w-0 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 overflow-hidden">
        <Card class="!bg-ink-900 dark:!bg-zinc-900 dark:!border dark:!border-zinc-800 !text-white !rounded-3xl !shadow-soft !border-0 !overflow-hidden" :pt="{ body:{ class:'!p-0' }, content:{ class:'!p-0' } }">
          <template #content>
            <div class="p-4 sm:p-8 relative overflow-hidden w-full min-w-0">
              <div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
              <div class="absolute -right-10 bottom-0 w-64 h-64 bg-white rounded-full blur-[80px] opacity-[0.05]"></div>
              <div class="relative flex flex-col sm:flex-row gap-4 sm:gap-6 min-w-0">
                <button @click="showAvatar=true" class="group relative w-20 h-20 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 border-white/20 shrink-0 self-start focus:outline-none focus:ring-2 focus:ring-white/40 bg-white/10">
                  <Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:!object-cover [&_img]:!w-full [&_img]:!h-full" :pt="{ image:{ class:'w-full h-full object-cover' } }" />
                  <span class="absolute inset-0 bg-black/0 group-hover:bg-black/20 grid place-items-center opacity-0 group-hover:opacity-100 transition text-white text-xs font-semibold">Просмотр</span>
                </button>
                <div class="min-w-0 flex-1 overflow-hidden">
                  <div class="flex flex-wrap items-center gap-2 min-w-0">
                    <h1 class="text-[20px] sm:text-[26px] font-black tracking-tight leading-none break-all min-w-0">{{ u.name }}</h1>
                    <Tag v-if="u.is_admin || u.role==='admin'" value="ADMIN" class="!bg-amber-400 !text-ink-900 !border-0 !font-black !text-xs !rounded-full !px-2.5 !py-1" />
                  </div>
                  <p class="text-white/60 text-sm mt-2 truncate break-all">{{ u.email }}</p>
                  <p class="text-white/40 text-xs mt-1.5 flex flex-wrap items-center gap-2">
                    <Tag :value="levelLabel[u.level] || u.level || 'Новичок'" class="!rounded-full !text-xs !font-bold !border !px-2 !py-1" :class="levelColor[u.level||'novice'] || levelColor.novice" />
                    <span class="opacity-80 shrink-0">· {{ (u.reputation_score||0) }} ★</span>
                    <Tag :value="planLabel[u.plan||'free'] || u.plan" class="!rounded-full !text-xs !font-bold !border !px-2 !py-1" :class="planColor[u.plan||'free']" />
                  </p>
                  <div class="mt-4 flex flex-wrap gap-2">
                    <Button label="Открыть карту →" rounded class="!bg-white !text-ink-900 !border-white !text-sm !font-bold hover:!bg-stone-50 !px-6 !py-2.5" @click="router.visit('/map')" />
                    <Button v-if="isOwn" rounded class="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !text-white !border-0 !text-sm !font-bold !px-6 !py-2.5" @click="router.visit('/chat')">
                      <span class="inline-flex items-center gap-2">Чат</span>
                    </Button>
                    <Button icon="pi pi-share-alt" label="Поделиться" rounded severity="secondary" outlined class="!bg-white/10 !border-white/30 !text-white hover:!bg-white hover:!text-ink-900 !text-sm !font-bold !px-5 !py-2.5" :loading="sharing" @click="shareProfile({ id: u.id, name: u.name })" />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
        <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 min-w-0">
          <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft !overflow-hidden" :pt="{ body:{ class:'!p-0' }, content:{ class:'!p-0' } }">
            <template #content>
              <div class="p-4 sm:p-6 relative overflow-hidden min-w-0 w-full max-w-full">
                <div class="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-indigo-500/10 rounded-full blur-2xl"></div>
                <div class="relative flex items-start justify-between gap-3 min-w-0">
                  <div class="flex items-center gap-3 min-w-0">
                    <Avatar label="◎" shape="square" class="!w-9 !h-9 sm:!w-10 sm:!h-10 !rounded-2xl !bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !shadow-soft" />
                    <div class="min-w-0">
                      <h3 class="font-black tracking-tight leading-none text-[15px] sm:text-base truncate dark:text-white">Общая информация</h3>
                      <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1 truncate">Профиль · видимость · приватность</p>
                    </div>
                  </div>
                </div>
                <div class="mt-5 grid gap-2.5 min-w-0">
                  <div class="group flex items-center gap-2 sm:gap-3 p-3 rounded-3xl bg-stone-50/80 dark:bg-zinc-800/60 border border-stone-100 dark:border-zinc-700/60 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-soft transition min-w-0 overflow-hidden">
                    <Avatar label="👤" shape="square" class="!w-8 !h-8 sm:!w-9 sm:!h-9 !rounded-xl !bg-white dark:!bg-zinc-700 !border !border-stone-200 dark:!border-zinc-600 !text-sm shrink-0" />
                    <div class="min-w-0 flex-1 overflow-hidden">
                      <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Имя</div>
                      <div class="text-sm font-bold dark:text-white truncate break-all">{{ u.name }}</div>
                    </div>
                    <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] shrink-0"></span>
                  </div>
                  <div class="group flex items-center gap-2 sm:gap-3 p-3 rounded-3xl bg-stone-50/80 dark:bg-zinc-800/60 border border-stone-100 dark:border-zinc-700/60 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-soft transition min-w-0 overflow-hidden">
                    <Avatar label="✉️" shape="square" class="!w-8 !h-8 sm:!w-9 sm:!h-9 !rounded-xl !bg-white dark:!bg-zinc-700 !border !border-stone-200 dark:!border-zinc-600 !text-sm shrink-0" />
                    <div class="min-w-0 flex-1 overflow-hidden">
                      <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">Email</div>
                      <div class="text-sm font-semibold dark:text-white truncate break-all">{{ u.email }}</div>
                    </div>
                    <Tag v-if="u.email_verified_at" value="✓ Подтверждена" class="!text-[10px] !font-black !bg-emerald-50 !text-emerald-700 dark:!bg-emerald-900/30 dark:!text-emerald-300 !border-emerald-200 dark:!border-emerald-800 !rounded-full !px-2 !py-1 hidden sm:inline-flex" />
                    <Tag v-else value="не подтверждён" class="!text-[10px] !font-bold !bg-amber-50 !text-amber-700 dark:!bg-amber-900/30 dark:!text-amber-300 !border-amber-200 dark:!border-amber-800 !rounded-full !px-2 !py-1 hidden sm:inline-flex" />
                  </div>
                  <Card class="!bg-stone-50/80 dark:!bg-zinc-800/60 !border-stone-100 dark:!border-zinc-700/60 !rounded-3xl !shadow-none" :pt="{ body:{ class:'!p-3 sm:!p-3.5' }, content:{ class:'!p-0' } }">
                    <template #content>
                      <div class="flex items-center gap-2 min-w-0">
                        <Avatar label="✨" shape="square" class="!w-7 !h-7 !rounded-lg !bg-white dark:!bg-zinc-700 !border !border-stone-200 dark:!border-zinc-600 !text-xs shrink-0" />
                        <div class="text-[10px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500 truncate">О себе</div>
                        <Link v-if="isOwn" :href="settingsHref" class="ml-auto text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline shrink-0">изменить</Link>
                      </div>
                      <div v-if="!bioEmpty" class="mt-2.5 text-sm leading-relaxed text-stone-700 dark:text-zinc-300 whitespace-pre-wrap break-words overflow-hidden">{{ bioText }}</div>
                      <div v-else class="mt-2 text-sm leading-relaxed break-words text-stone-500 dark:text-zinc-400">{{ isOwn ? 'Расскажи о себе — это видят другие на твоём профиле. Добавь в настройках.' : 'Пользователь пока ничего не рассказал о себе.' }}</div>
                    </template>
                  </Card>
                  <div class="flex items-center gap-3 p-3 rounded-3xl bg-gradient-to-br from-emerald-50/70 to-teal-50/70 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/40 hover:shadow-soft transition">
                    <Avatar label="📍" shape="square" class="!w-9 !h-9 !rounded-xl !bg-white dark:!bg-zinc-800 !border !border-emerald-200 dark:!border-emerald-800 !text-sm shrink-0" />
                    <div class="min-w-0 flex-1">
                      <div class="text-[10px] font-bold tracking-widest uppercase text-emerald-700/60 dark:text-emerald-300/60">Домашняя зона</div>
                      <div class="text-sm font-bold dark:text-white truncate">{{ u.home_lat && u.home_lng ? `${Number(u.home_lat).toFixed(4)}, ${Number(u.home_lng).toFixed(4)}` : 'не задана' }}</div>
                    </div>
                    <Tag :value="`${u.home_radius_km||2} км`" class="!rounded-full !bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !border-0 !text-xs !font-black !px-3 !py-1.5 shrink-0" />
                  </div>
                  <div class="flex items-center gap-3 p-3 rounded-3xl border transition" :class="u.is_anonymous_default ? 'bg-violet-50/70 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/50' : 'bg-stone-50/80 dark:bg-zinc-800/60 border-stone-100 dark:border-zinc-700/60'">
                    <Avatar :label="u.is_anonymous_default ? '🕶️' : '👁️'" shape="square" class="!w-9 !h-9 !rounded-xl !text-sm shrink-0 !border" :class="u.is_anonymous_default ? '!bg-violet-600 !text-white !border-violet-600' : '!bg-white dark:!bg-zinc-700 !border-stone-200 dark:!border-zinc-600'" />
                    <div class="min-w-0 flex-1">
                      <div class="text-[10px] font-bold tracking-widest uppercase" :class="u.is_anonymous_default ? 'text-violet-600 dark:text-violet-300' : 'text-stone-400 dark:text-zinc-500'">Анонимность</div>
                      <div class="text-sm font-bold dark:text-white leading-none">{{ u.is_anonymous_default ? 'Включена по умолчанию' : 'Выключена' }}</div>
                      <div class="text-[11px] mt-0.5" :class="u.is_anonymous_default ? 'text-violet-600/70 dark:text-violet-300/70' : 'text-stone-500 dark:text-zinc-400'">пины скрывают автора</div>
                    </div>
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="u.is_anonymous_default ? 'bg-violet-600 shadow-[0_0_0_4px_rgba(124,58,237,0.15)]' : 'bg-stone-300 dark:bg-zinc-600'"></span>
                  </div>
                </div>
              </div>
            </template>
          </Card>
          <div class="space-y-4 min-w-0 w-full max-w-full">
            <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body:{ class:'!p-4 sm:!p-6' }, content:{ class:'!p-0' } }">
              <template #content>
                <h3 class="font-black tracking-tight dark:text-white">Действия</h3>

                <div class="mt-4 grid grid-cols-2 gap-3">
                  <Card class="!bg-ink-900 dark:!bg-white !text-white dark:!text-ink-900 !rounded-3xl !border-0 !shadow-soft hover:!opacity-90 !cursor-pointer" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }" @click="router.visit('/map')">
                    <template #content>
                      <div class="flex flex-col gap-1"><Avatar label="🗺️" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white/15 dark:!bg-ink-900/10 !text-sm" /><span class="text-sm font-bold leading-tight">Карта</span><span class="text-[11px] opacity-60">пины рядом</span></div>
                    </template>
                  </Card>
                  <Card v-if="isOwn" class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl hover:!bg-white dark:hover:!bg-zinc-700 !cursor-pointer" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }" @click="router.visit(settingsHref)">
                    <template #content>
                      <div class="flex flex-col gap-1"><Avatar label="⚙️" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white dark:!bg-zinc-700 !border !text-sm" /><span class="text-sm font-bold leading-tight dark:text-white">Настройки</span><span class="text-[11px] text-stone-500 dark:text-zinc-400">тариф и прочее</span></div>
                    </template>
                  </Card>
                  <Card class="!bg-gradient-to-br !from-brand-500 !to-accent-teal !text-white !rounded-3xl !border-0 hover:!opacity-90 !cursor-pointer" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }" @click="router.visit('/map')">
                    <template #content>
                      <div class="flex flex-col gap-1"><Avatar label="＋" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white/20 !text-white" /><span class="text-sm font-bold leading-tight">Новый пин</span><span class="text-[11px] opacity-80">в 2 клика</span></div>
                    </template>
                  </Card>
                  <Card class="!bg-stone-50 dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 !rounded-3xl hover:!bg-white !cursor-pointer" :pt="{ body:{ class:'!p-4' }, content:{ class:'!p-0' } }" @click="router.visit('/faq')">
                    <template #content>
                      <div class="flex flex-col gap-1"><Avatar label="?" shape="square" class="!w-8 !h-8 !rounded-xl !bg-white dark:!bg-zinc-700 !border !text-sm" /><span class="text-sm font-bold leading-tight dark:text-white">FAQ</span><span class="text-[11px] text-stone-500">как это работает</span></div>
                    </template>
                  </Card>
                </div>
                <p class="text-xs text-stone-500 dark:text-zinc-400 mt-4 leading-relaxed">Ты — не точка, ты — пин. Размытие 200м, анонимные пины и блок в 1 клик.</p>
              </template>
            </Card>
            <Card v-if="isOwn" class="!bg-gradient-to-br !from-amber-50 !to-orange-50 dark:!from-amber-950/20 dark:!to-orange-950/20 !border-amber-200 dark:!border-amber-900 !rounded-3xl" :pt="{ body:{ class:'!p-4 sm:!p-5' }, content:{ class:'!p-0' } }">
              <template #content>
                <div class="text-sm font-black dark:text-white">Нужна помощь?</div>
                <p class="text-xs text-stone-600 dark:text-zinc-400 mt-1">Напиши в поддержку или задонать проекту — всё в настройках.</p>
                <Button label="Перейти в настройки →" rounded size="small" class="!bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white !border-ink-900 dark:!border-white !text-xs !font-bold mt-3" @click="router.visit(settingsHref)" />
              </template>
            </Card>
          </div>
        </div>
      </div>
      <AvatarPreview :src="avatarSrc" :name="u.name" :open="showAvatar" @close="showAvatar=false" />
    </div>
  </AuthenticatedLayout>
</template>
