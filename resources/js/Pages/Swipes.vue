<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed, onMounted, ref } from 'vue'
import GuestLayout from '@/Layouts/GuestLayout.vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import DatingQuestionnaireForm from '@/Components/Features/Dating/DatingQuestionnaireForm.vue'
import SwipeDetailsDialog from '@/Components/Features/Dating/SwipeDetailsDialog.vue'
import DefaultModeHint from '@/Components/Features/Mode/DefaultModeHint.vue'
import { useSwipes } from '@/composables/useSwipes'
import { useSwipeCardPhotos } from '@/composables/useSwipeCardPhotos'
import { useSwipesMobileMenu } from '@/composables/useSwipesMobileMenu'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Drawer from 'primevue/drawer'
import Select from 'primevue/select'
import Avatar from 'primevue/avatar'
import Chip from 'primevue/chip'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import DatePicker from 'primevue/datepicker'

const seo = useSeo({
  title: 'ULove — свайпы и знакомства',
  description: 'ULove — дейтинг с картой: листай людей рядом, мэтч открывает чат. Free: 3 сообщения, PRO: 10. Строго 18+.',
  keywords: ['ULove', 'UPin', 'знакомства', 'свайпы', 'мэтч', 'дейтинг'],
})

const page = usePage()
const isAuth = computed(() => !!(page.props.auth as any)?.user)
const Layout = computed(() => (isAuth.value ? AuthenticatedLayout : GuestLayout))

const s = useSwipes()
const cardPhotos = useSwipeCardPhotos(() => s.current.value)
const mobileMenu = useSwipesMobileMenu()
const { selectPt } = useDropdownMenuStyle()

const detailsCard = ref<any | null>(null)

function goalShort(card: any): string {
  const custom = String(card?.custom_goal ?? '').trim()
  if (custom) return custom.length > 42 ? `${custom.slice(0, 42)}…` : custom
  return s.goalLabel(card?.goal ?? null)
}

const dialogPt = {
  root: { class: '!rounded-3xl dark:!bg-zinc-900 dark:!border-zinc-700' },
  header: { class: 'dark:!bg-zinc-900 dark:!text-white' },
  content: { class: 'dark:!bg-zinc-900 dark:!text-zinc-100 !max-h-[78dvh] !overflow-y-auto' },
}

const interestTags = ['музыка', 'спорт', 'кино', 'путешествия', 'игры', 'еда', 'книги', 'танцы']

const goalOptions = [
  { label: 'Любая цель', value: null },
  { label: 'Отношения', value: 'love' },
  { label: 'Флирт', value: 'flirt' },
  { label: 'Дружба', value: 'friendship' },
  { label: 'Общение', value: 'chat' },
  { label: 'По интересам', value: 'interests' },
]

const genderOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Девушки', value: 'female' },
  { label: 'Парни', value: 'male' },
]

const radiusOptions = [
  { label: 'Все люди (без ограничений)', value: null },
  { label: 'Рядом: до 10 км', value: 10 },
  { label: 'Рядом: до 25 км · PRO', value: 25 },
  { label: 'Рядом: до 50 км · PRO', value: 50 },
  { label: 'Рядом: до 100 км · PRO', value: 100 },
]

onMounted(async () => {
  if (isAuth.value) {
    const stopRealtime = s.subscribeRealtime()
    ;(window as any).__swipesRealtimeStop?.()
    ;(window as any).__swipesRealtimeStop = stopRealtime
    await s.loadFeed()
    await s.loadMatches()
    await s.loadFavorites()
    await s.loadAdmirers()
    await s.loadActive()
  }
})
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
  </Head>
  <component :is="Layout">
    <div class="page-scroll bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[640px] mx-auto px-3 sm:px-6 pt-3 pb-1 sm:py-6 sm:pb-[calc(2rem+var(--sab))]">

        <div class="text-center">
          <div class="flex items-center justify-center gap-2.5">
            <span class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400 grid place-items-center text-white shadow-lg shadow-rose-500/30 dark:shadow-rose-500/20"><i class="pi pi-heart-fill text-lg sm:text-xl" /></span>
            <h1 class="text-[32px] sm:text-[42px] font-black tracking-[-0.04em] leading-none bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 dark:from-rose-400 dark:via-fuchsia-400 dark:to-orange-300 bg-clip-text text-transparent">ULove</h1>
          </div>
          <p class="mt-2 hidden sm:block text-[13px] sm:text-sm text-stone-500 dark:text-zinc-400">Дейтинг внутри UPin🔥</p>
        </div>
        <div v-if="isAuth" class="mt-3 flex justify-center">
          <DefaultModeHint place="swipes" />
        </div>

        <template v-if="!isAuth">
          <div class="mt-6 rounded-[20px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-center shadow-soft">
            <div class="text-lg font-black text-stone-900 dark:text-white">Войди, чтобы листать</div>
            <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Свайпы, мэтчи и чаты доступны после входа.</div>
            <div class="mt-4 flex gap-2 justify-center">
              <Link href="/login"><Button label="Войти" rounded /></Link>
              <Link href="/register"><Button label="Регистрация" severity="secondary" rounded outlined /></Link>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center gap-2 h-[1.2rem] sm:h-auto py-0 sm:py-1 overflow-hidden">
            <Button icon="pi pi-arrow-left" rounded text aria-label="Выйти из свайпов" title="Выйти из свайпов" class="!w-7 !h-7 sm:!w-10 sm:!h-10 !p-0 shrink-0" @click="mobileMenu.goBack()" />
            <Button icon="pi pi-user" rounded text aria-label="Мой профиль" title="Мой профиль" class="!w-7 !h-7 sm:!w-10 sm:!h-10 !p-0 shrink-0" @click="mobileMenu.goProfile()" />
            <span class="flex-1" />
          </div>
          <div class="mt-2 sm:mt-4 hidden sm:flex items-center gap-2">
            <Button icon="pi pi-bars" severity="secondary" rounded outlined size="small" aria-label="Меню свайпов" title="Лента · Активные · Избранное · Лайки · Анкета · PRO" @click="mobileMenu.open()" />
            <Chip :label="s.quotaLabel.value" icon="pi pi-send" class="!rounded-full" />
            <Chip v-if="s.isQuotaEmpty.value" label="Лимит исчерпан — мэтчи пишут бесплатно" icon="pi pi-heart-fill" class="!rounded-full !bg-rose-100 !text-rose-700 dark:!bg-rose-950 dark:!text-rose-300 dark:!border dark:!border-rose-900" />
            <span class="flex-1" />
            <Button icon="pi pi-user-edit" severity="secondary" rounded outlined size="small" aria-label="Моя анкета" title="Моя анкета — что ищешь, о себе, интересы" @click="s.goTab('questionnaire')" />
            <Button icon="pi pi-question-circle" severity="secondary" rounded outlined size="small" aria-label="Как работают свайпы" title="Как работают свайпы" @click="s.showHelp.value = true" />
            <Button icon="pi pi-sliders-h" severity="secondary" rounded outlined size="small" aria-label="Фильтры" @click="s.showFilters.value = true" />
            <Button v-if="s.canResetHistory.value" icon="pi pi-trash" severity="warn" rounded outlined size="small" aria-label="Сбросить просмотренные" :title="s.isAdmin.value ? 'Сбросить просмотренные (админ, безлимит)' : 'Сбросить просмотренные (1 раз)'" :loading="s.resetting.value" @click="s.resetHistory()" />
          </div>

          <div v-if="s.matches.value.length" class="mt-4 hidden sm:block">
            <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 mb-2">Мэтчи · чат открыт</div>
            <div class="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-1 px-1">
              <button
                v-for="m in s.matches.value"
                :key="m.match_id"
                class="shrink-0 flex flex-col items-center w-[64px] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                @click="s.openChat(m.user.id, m.conversation_id)"
              >
                <span class="relative block">
                  <Avatar :image="m.user.avatar_url ?? undefined" :label="!m.user.avatar_url ? (m.user.name ?? '?').slice(0, 1) : undefined" shape="circle" size="large" class="!w-14 !h-14 ring-2 ring-emerald-400 dark:ring-emerald-500" />
                  <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 grid place-items-center ring-2 ring-white dark:ring-zinc-900"><i class="pi pi-heart-fill text-white text-[10px]" /></span>
                </span>
                <span class="mt-1.5 text-[11px] font-semibold leading-tight text-stone-600 dark:text-zinc-200 truncate w-full text-center">{{ m.user.name }}</span>
              </button>
            </div>
          </div>

          <div v-if="s.error.value" class="mt-3 text-sm text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl px-4 py-3">
            {{ s.error.value }}
          </div>

          <template v-if="s.activeTab.value === 'active'">
            <div v-if="s.activeLoading.value" class="mt-4 rounded-[24px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-[40dvh] min-h-[240px] grid place-items-center">
              <i class="pi pi-spin pi-spinner text-2xl text-stone-400 dark:text-zinc-500" />
            </div>
            <div v-else-if="s.activeUsers.value.length" class="mt-4">
              <div class="text-xs text-stone-500 dark:text-zinc-400 mb-2">Сейчас в ULove · {{ s.activeUsers.value.length }} онлайн</div>
              <div class="grid grid-cols-2 gap-1.5 min-[411px]:gap-2">
                <div
                  v-for="u in s.activeUsers.value"
                  :key="u.id"
                  class="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex flex-col items-center text-center"
                >
                  <Link :href="`/users/${u.id}`" class="relative shrink-0">
                    <Avatar :image="u.avatar_url ?? undefined" :label="!u.avatar_url ? (u.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-16 !h-16" />
                    <span class="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" title="В сети" />
                  </Link>
                  <Link :href="`/users/${u.id}`" class="mt-2 min-w-0 w-full">
                    <div class="text-sm font-bold truncate text-stone-900 dark:text-white">{{ u.name }} · {{ s.ageLabel(u) }}</div>
                    <div v-if="u.city" class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ u.city }}</div>
                    <div v-if="u.distance_km != null" class="text-[11px] text-stone-500 dark:text-zinc-400">{{ u.distance_km }} км</div>
                  </Link>
                  <Button
                    icon="pi pi-send"
                    :label="u.can_message ? 'Написать' : 'Закрыто'"
                    rounded
                    size="small"
                    class="mt-2 w-full"
                    :disabled="!u.can_message"
                    :title="u.can_message ? 'Написать' : (u.can_message_reason ?? 'Написать нельзя')"
                    :loading="s.creatingChat.value"
                    @click="s.writeWithoutMatch(u.id)"
                  />
                  <div v-if="!u.can_message && u.can_message_reason" class="mt-1 text-[10px] leading-tight text-stone-400 dark:text-zinc-500">{{ u.can_message_reason }}</div>
                </div>
              </div>
              <div class="mt-2 text-center">
                <Button label="Обновить" icon="pi pi-refresh" severity="secondary" rounded outlined size="small" :loading="s.activeLoading.value" @click="s.loadActive()" />
              </div>
            </div>
            <div v-else class="mt-4 rounded-[24px] border border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-500 grid place-items-center"><i class="pi pi-users text-xl" /></div>
              <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Пока никого онлайн</div>
              <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Загляни в ленту — там все люди, а сюда возвращайся за живым общением.</div>
              <div class="mt-4 flex gap-2 justify-center">
                <Button label="К ленте" rounded size="small" @click="s.goTab('feed')" />
                <Button label="Обновить" severity="secondary" rounded outlined size="small" @click="s.loadActive()" />
              </div>
            </div>
          </template>

          <template v-else-if="s.activeTab.value === 'favorites'">
            <div v-if="s.favoritesLoading.value" class="mt-4 rounded-[24px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-[40dvh] min-h-[240px] grid place-items-center">
              <i class="pi pi-spin pi-spinner text-2xl text-stone-400 dark:text-zinc-500" />
            </div>
            <div v-else-if="s.favorites.value.length" class="mt-4 space-y-2">
              <div
                v-for="f in s.favorites.value"
                :key="f.id"
                class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
              >
                <Link :href="`/users/${f.id}`" class="shrink-0"><Avatar :image="f.avatar_url ?? undefined" :label="!f.avatar_url ? (f.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-12 !h-12" /></Link>
                <Link :href="`/users/${f.id}`" class="min-w-0 flex-1">
                  <div class="text-sm font-bold truncate text-stone-900 dark:text-white">{{ f.name }}<span class="font-semibold text-stone-500 dark:text-zinc-400"> · {{ s.ageLabel(f) }}</span></div>
                  <div v-if="f.city" class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ f.city }}</div>
                </Link>
                <Button icon="pi pi-send" rounded size="small" aria-label="Написать" title="Написать" :loading="s.creatingChat.value" class="!w-10 !h-10 !p-0 shrink-0" @click="s.writeWithoutMatch(f.id)" />
                <Button icon="pi pi-times" rounded size="small" severity="secondary" outlined aria-label="Убрать" title="Убрать из избранного" class="!w-10 !h-10 !p-0 shrink-0" @click="s.removeFavorite(f.id)" />
              </div>
              <div class="text-center text-[11px] text-stone-400 dark:text-zinc-500">Занято {{ s.favoritesCount.value }} из {{ s.favoritesLimit.value }} · Free: до 2 · Pro: до 5</div>
            </div>
            <div v-else class="mt-4 rounded-[24px] border border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 grid place-items-center"><i class="pi pi-star text-xl" /></div>
              <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Пока пусто</div>
              <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Лайкни кого-то в ленте — не потеряешь. Free: до {{ s.favoritesLimit.value }}.</div>
              <div class="mt-4"><Button label="К ленте" rounded size="small" @click="s.goTab('feed')" /></div>
            </div>
          </template>

          <template v-else-if="s.activeTab.value === 'admirers'">
            <div v-if="s.admirersLoading.value" class="mt-4 rounded-[24px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-[40dvh] min-h-[240px] grid place-items-center">
              <i class="pi pi-spin pi-spinner text-2xl text-stone-400 dark:text-zinc-500" />
            </div>
            <div v-else-if="s.admirers.value.length" class="mt-4 space-y-2">
              <div v-if="s.admirersIncognito.value" class="text-center text-[11px] font-bold text-violet-600 dark:text-violet-300">🕵️ {{ s.admirersIncognito.value }} — тайные поклонники (PRO)</div>
              <div
                v-for="f in s.admirers.value"
                :key="`${f.id}-${f.is_incognito ? 'inc' : 'open'}`"
                class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
              >
                <component :is="f.is_incognito ? 'span' : Link" :href="f.is_incognito ? undefined : `/users/${f.id}`" class="shrink-0">
                  <Avatar :image="(!f.is_incognito && f.avatar_url) ? f.avatar_url : undefined" :label="f.is_incognito ? '🕵️' : (!f.avatar_url ? (f.name ?? '?').slice(0, 1) : undefined)" shape="circle" class="!w-12 !h-12" />
                </component>
                <component :is="f.is_incognito ? 'span' : Link" :href="f.is_incognito ? undefined : `/users/${f.id}`" class="min-w-0 flex-1">
                  <div class="text-sm font-bold truncate text-stone-900 dark:text-white">{{ f.is_incognito ? 'Тайный поклонник' : f.name }}<span v-if="!f.is_incognito" class="font-semibold text-stone-500 dark:text-zinc-400"> · {{ s.ageLabel(f) }}</span></div>
                  <div v-if="f.is_incognito" class="text-[11px] text-violet-500 font-bold">Скрыл себя · PRO · лайкни в ответ — откроется при мэтче</div>
                  <div v-else-if="f.city" class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ f.city }}</div>
                </component>
                <Chip v-if="f.liked_me || f.is_match" label="Взаимно" icon="pi pi-heart-fill" class="!rounded-full !text-[10px]" />
                <Button v-if="!f.is_incognito" icon="pi pi-heart-fill" rounded size="small" aria-label="Лайк в ответ" title="Лайк в ответ" :loading="s.acting.value" class="!w-10 !h-10 !p-0 shrink-0" @click="s.swipeAdmirer(f.id)" />
                <Button v-if="!f.is_incognito" icon="pi pi-send" rounded size="small" severity="secondary" outlined aria-label="Написать" title="Написать" :loading="s.creatingChat.value" class="!w-10 !h-10 !p-0 shrink-0" @click="s.writeWithoutMatch(f.id)" />
              </div>
            </div>
            <div v-else class="mt-4 rounded-[24px] border border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 grid place-items-center"><i class="pi pi-heart text-xl" /></div>
              <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Тебя пока не лайкнули</div>
              <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Заполни анкету и добавь фото — так заметнее. Каждый лайк прилетит в колокольчик.</div>
              <div class="mt-4"><Button label="К ленте" rounded size="small" @click="s.goTab('feed')" /></div>
            </div>
          </template>

          <template v-else-if="s.activeTab.value === 'questionnaire'">
            <div class="mt-4 rounded-[24px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-soft">
              <div class="mb-4 flex items-center gap-2.5">
                <span class="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 grid place-items-center text-white"><i class="pi pi-user-edit" /></span>
                <div>
                  <div class="text-base font-black text-stone-900 dark:text-white">Моя анкета</div>
                  <div class="text-xs text-stone-500 dark:text-zinc-400">Так тебя видят в ленте ULove</div>
                </div>
              </div>
              <DatingQuestionnaireForm />
            </div>
          </template>

          <template v-else-if="s.activeTab.value === 'premium'">
            <div class="mt-4 rounded-[24px] bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-4 sm:p-6 text-white shadow-soft">
              <div class="flex items-center gap-2.5">
                <span class="w-10 h-10 rounded-2xl bg-white/20 grid place-items-center"><i class="pi pi-crown" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-base font-black">ULove PRO</div>
                  <div class="text-xs text-white/80">Твой тариф: {{ s.planLabel.value }}</div>
                </div>
                <Chip :label="s.quotaLabel.value" icon="pi pi-send" class="!rounded-full !bg-white/20 !text-white !border-0 text-xs" />
              </div>
              <div class="mt-3 text-[13px] text-white/90">Все платные плюшки свайпов — в одном месте: включай, проверяй статус, оформляй тариф.</div>
              <div class="mt-3">
                <Link href="/settings"><Button label="Выбрать тариф" icon="pi pi-crown" rounded size="small" class="!bg-white !text-orange-600 !border-0" /></Link>
              </div>
            </div>

            <div class="mt-2 space-y-2">
              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-violet-500/15 text-violet-500 grid place-items-center shrink-0"><i class="pi pi-eye-slash" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Инкогнито-лайк <span class="text-violet-500">PRO</span></div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ s.canIncognito.value ? 'Тебя увидят как «Тайный поклонник»' : 'Включи — подскажем, как оформить PRO' }}</div>
                </div>
                <ToggleSwitch class="shrink-0" :model-value="s.incognitoLike.value" input-id="premium-incognito" @update:model-value="(v:boolean)=>s.setIncognito(v)" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-300 grid place-items-center shrink-0"><i class="pi pi-map-marker" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Люди рядом <span class="text-amber-500">PRO</span></div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Сейчас: {{ s.filters.value.radius_km ? `до ${s.filters.value.radius_km} км` : 'все люди' }} · Free — до 10 км</div>
                </div>
                <Button label="Фильтры" icon="pi pi-sliders-h" rounded outlined size="small" @click="s.showFilters.value = true" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300 grid place-items-center shrink-0"><i class="pi pi-user" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Скрыть имя <span class="text-amber-500">PRO</span></div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ s.privacy.value.dating_hide_name ? 'Имя скрыто' : 'Все видят твоё имя' }}</div>
                </div>
                <ToggleSwitch class="shrink-0" :model-value="s.privacy.value.dating_hide_name" input-id="premium-hide-name" @update:model-value="(v:boolean)=>s.setPrivacyFlag('dating_hide_name', v)" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300 grid place-items-center shrink-0"><i class="pi pi-calendar" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Скрыть возраст <span class="text-amber-500">PRO</span></div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ s.privacy.value.dating_hide_age ? 'Возраст скрыт' : 'Все видят твой возраст' }}</div>
                </div>
                <ToggleSwitch class="shrink-0" :model-value="s.privacy.value.dating_hide_age" input-id="premium-hide-age" @update:model-value="(v:boolean)=>s.setPrivacyFlag('dating_hide_age', v)" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 grid place-items-center shrink-0"><i class="pi pi-lock" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Пишут только мэтчи <span class="text-emerald-500">Free</span></div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Закрыть личку от незнакомцев</div>
                </div>
                <ToggleSwitch class="shrink-0" :model-value="s.privacy.value.dating_match_only" input-id="premium-match-only" @update:model-value="(v:boolean)=>s.setPrivacyFlag('dating_match_only', v)" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 grid place-items-center shrink-0"><i class="pi pi-star" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Избранное {{ s.favoritesCount.value }}/{{ s.favoritesLimit.value }}</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Free — до 2 · Pro — до 5 · Business — до 15</div>
                </div>
                <Button label="Открыть" icon="pi pi-star" rounded outlined size="small" @click="s.goTab('favorites')" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 grid place-items-center shrink-0"><i class="pi pi-send" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">{{ s.quotaLabel.value || 'Сообщения' }}</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Free — 3/мес · PRO — 10/мес · мэтчи пишут бесплатно</div>
                </div>
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-zinc-500/15 text-stone-500 dark:text-zinc-300 grid place-items-center shrink-0"><i class="pi pi-images" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">До 5 фото в анкете <span class="text-amber-500">PRO</span></div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Free — до 3 фото · фото добавляют в профиле</div>
                </div>
                <Link href="/profile"><Button label="Фото" icon="pi pi-camera" rounded outlined size="small" /></Link>
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-500 grid place-items-center shrink-0"><i class="pi pi-refresh" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Начать заново</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ s.canResetHistory.value ? 'Вернёт всех просвайпанных в ленту' : 'Одноразовый сброс уже использован' }}</div>
                </div>
                <Button v-if="s.canResetHistory.value" :label="s.isAdmin.value ? 'Сбросить' : 'Сбросить (1 раз)'" icon="pi pi-trash" severity="warn" rounded outlined size="small" :loading="s.resetting.value" @click="s.resetHistory()" />
              </div>
            </div>
          </template>

          <template v-else>
          <div class="mt-3 mb-3 sm:mt-4 sm:mb-0 relative select-none">
            <div v-if="s.loading.value" class="rounded-[20px] min-[411px]:rounded-[24px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-[calc(100dvh-180px-var(--sab))] min-h-[400px] min-[411px]:h-[calc(100dvh-170px-var(--sab))] min-[411px]:min-h-[480px] sm:h-[62dvh] sm:min-h-[400px] sm:max-h-[540px] grid place-items-center">
              <i class="pi pi-spin pi-spinner text-2xl text-stone-400 dark:text-zinc-500" />
            </div>

            <div v-else-if="s.current.value">
              <div class="swipe-deck relative h-[calc(100dvh-180px-var(--sab))] min-h-[400px] min-[411px]:h-[calc(100dvh-170px-var(--sab))] min-[411px]:min-h-[480px] sm:h-[62dvh] sm:min-h-[400px] sm:max-h-[540px]">
              <div
                v-if="s.next.value"
                class="absolute inset-0 z-0 rounded-[24px] overflow-hidden bg-zinc-900 dark:bg-zinc-950 shadow-soft ring-1 ring-black/10 dark:ring-white/10 pointer-events-none"
                :style="s.stackCardStyle.value"
              >
                <img
                  v-if="s.next.value.photos[0]"
                  :src="s.next.value.photos[0]"
                  alt=""
                  class="absolute inset-0 w-full h-full object-cover"
                  draggable="false"
                />
                <div v-else class="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400">
                  <span class="text-white text-7xl font-black">{{ (s.next.value.name ?? '?').slice(0, 1) }}</span>
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div class="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white">
                  <div class="flex items-baseline gap-2">
                    <span class="text-[24px] font-black leading-none">{{ s.next.value.name }}</span>
                    <span class="text-lg font-bold opacity-90">{{ s.ageLabel(s.next.value) }}</span>
                  </div>
                </div>
              </div>

              <div
                class="swipe-top absolute inset-0 z-10 rounded-[24px] overflow-hidden bg-zinc-900 dark:bg-zinc-950 shadow-soft touch-pan-y ring-1 ring-black/10 dark:ring-white/10 cursor-grab active:cursor-grabbing"
                :style="s.topCardStyle.value"
                @pointerdown="s.dragStart($event.clientX, $event.clientY)"
                @pointermove="s.dragMove($event.clientX, $event.clientY)"
                @pointerup="s.dragEnd()"
                @pointercancel="s.dragEnd()"
                @pointerleave="s.dragEnd()"
              >
                <div
                  v-if="cardPhotos.hasMultiple.value"
                  class="absolute top-0 inset-x-0 z-20 px-2.5 pt-2.5 pb-6 bg-gradient-to-b from-black/55 to-transparent pointer-events-none"
                >
                  <div class="flex gap-1.5" role="tablist" aria-label="Фото профиля">
                    <button
                      v-for="(p, i) in cardPhotos.photos.value"
                      :key="`${s.current.value.id}-${i}`"
                      type="button"
                      role="tab"
                      :aria-selected="i === cardPhotos.photoIndex.value"
                      class="flex-1 py-1 cursor-pointer pointer-events-auto"
                      :aria-label="`Фото ${i + 1} из ${cardPhotos.total.value}`"
                      @pointerdown.stop
                      @click="cardPhotos.goTo(i)"
                    >
                      <span class="block h-[4px] rounded-full overflow-hidden bg-white/35">
                        <span
                          :key="`${s.current.value.id}-${cardPhotos.photoIndex.value}-${i}`"
                          class="block h-full rounded-full bg-white"
                          :class="i === cardPhotos.photoIndex.value ? 'story-fill' : ''"
                          :style="{
                            width: i < cardPhotos.photoIndex.value ? '100%' : i === cardPhotos.photoIndex.value ? undefined : '0%',
                            animationDuration: i === cardPhotos.photoIndex.value ? `${cardPhotos.intervalMs}ms` : undefined,
                          }"
                        />
                      </span>
                    </button>
                  </div>
                </div>
                <img
                  v-if="cardPhotos.currentPhoto.value"
                  :src="cardPhotos.currentPhoto.value"
                  :key="`${s.current.value.id}-${cardPhotos.photoIndex.value}`"
                  alt=""
                  class="absolute inset-0 w-full h-full object-cover"
                  draggable="false"
                />
                <div v-else class="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 dark:from-violet-900 dark:via-fuchsia-900 dark:to-orange-900">
                  <span class="text-white text-7xl font-black">{{ (s.current.value.name ?? '?').slice(0, 1) }}</span>
                </div>
                <div
                  v-if="cardPhotos.hasMultiple.value"
                  class="absolute inset-0"
                  @pointerdown="cardPhotos.tapDown($event)"
                  @pointerup="cardPhotos.tapUp($event)"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                <div
                  class="absolute top-12 left-5 rotate-[-12deg] border-4 border-emerald-400 text-emerald-300 font-black text-2xl px-3 py-1 rounded-xl bg-black/20"
                  :style="{ opacity: s.likeStrength.value, transform: `scale(${0.8 + s.likeStrength.value * 0.3})` }"
                >ЛАЙК</div>
                <div
                  class="absolute top-12 right-5 rotate-[12deg] border-4 border-rose-500 text-rose-400 font-black text-2xl px-3 py-1 rounded-xl bg-black/20"
                  :style="{ opacity: s.passStrength.value, transform: `scale(${0.8 + s.passStrength.value * 0.3})` }"
                >ПАС</div>

                <div v-if="s.current.value.liked_me" class="absolute top-24 right-4 pointer-events-none">
                  <Chip label="Лайкнул тебя" icon="pi pi-heart-fill" class="!rounded-full !bg-rose-500 !text-white !border-0" />
                </div>
                <Button
                  icon="pi pi-info-circle"
                  rounded
                  aria-label="Подробнее об анкете"
                  title="Подробнее — интересы, о себе"
                  class="!absolute !top-11 !left-4 !z-30 !w-10 !h-10 !p-0 !rounded-full !bg-black/45 !border-0 !text-white backdrop-blur active:!scale-95"
                  @pointerdown.stop
                  @click="detailsCard = s.current.value"
                />

                <div class="absolute bottom-0 inset-x-0 p-3 pr-[108px] min-[411px]:p-4 min-[411px]:pr-[124px] sm:p-5 text-white pointer-events-none">
                  <div class="flex items-baseline gap-2">
                    <span class="text-[24px] sm:text-[26px] font-black leading-none">{{ s.current.value.name }}</span>
                    <span class="text-lg sm:text-xl font-bold opacity-90">{{ s.ageLabel(s.current.value) }}</span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <Chip :label="goalShort(s.current.value)" class="!rounded-full !bg-white/15 !text-white !border-0 text-xs" />
                    <Chip v-if="s.current.value.city" :label="s.current.value.city" icon="pi pi-map-marker" class="!rounded-full !bg-white/15 !text-white !border-0 text-xs" />
                    <Chip v-if="s.current.value.distance_km != null" :label="`${s.current.value.distance_km} км`" icon="pi pi-send" class="!rounded-full !bg-white/15 !text-white !border-0 text-xs" />
                  </div>
                  <div v-if="s.current.value.interests.length" class="mt-2 flex flex-wrap gap-1.5">
                    <Chip v-for="t in s.current.value.interests" :key="t" :label="`#${t}`" class="!rounded-full !bg-white/10 !text-white/90 !border !border-white/20 text-xs" />
                  </div>
                  <p v-if="s.current.value.bio" class="mt-2 text-sm text-white/85 line-clamp-2">{{ s.current.value.bio }}</p>
                </div>
                <div class="absolute bottom-4 right-4 z-30 flex items-center gap-2 sm:hidden">
                  <Button icon="pi pi-send" severity="info" rounded raised aria-label="Написать" title="Написать" class="!w-12 !h-12 !p-0 !text-lg" :loading="s.creatingChat.value" @pointerdown.stop @click="s.writeWithoutMatch(s.current.value.id)" />
                  <Button icon="pi pi-heart-fill" rounded raised aria-label="Лайк" title="Лайк" class="!w-14 !h-14 !p-0 !text-2xl !text-white !bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0" :loading="s.acting.value" @pointerdown.stop @click="s.swipe('like')" />
                </div>
              </div>

              <div
                v-if="s.exiting.value"
                class="fly-card absolute inset-0 z-20 rounded-[24px] overflow-hidden bg-zinc-900 dark:bg-zinc-950 shadow-soft ring-1 ring-black/10 dark:ring-white/10 pointer-events-none"
                :class="s.exiting.value.dir === 'like' ? 'fly-like' : 'fly-pass'"
                :style="{ '--from-x': `${s.exiting.value.fromX}px`, '--from-y': `${s.exiting.value.fromY}px` }"
              >
                <img
                  v-if="s.exiting.value.card.photos[0]"
                  :src="s.exiting.value.card.photos[0]"
                  alt=""
                  class="absolute inset-0 w-full h-full object-cover"
                  draggable="false"
                />
                <div v-else class="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400">
                  <span class="text-white text-7xl font-black">{{ (s.exiting.value.card.name ?? '?').slice(0, 1) }}</span>
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div
                  v-if="s.exiting.value.dir === 'like'"
                  class="absolute top-5 left-5 rotate-[-12deg] border-4 border-emerald-400 text-emerald-300 font-black text-2xl px-3 py-1 rounded-xl bg-black/20"
                >ЛАЙК</div>
                <div
                  v-else
                  class="absolute top-5 right-5 rotate-[12deg] border-4 border-rose-500 text-rose-400 font-black text-2xl px-3 py-1 rounded-xl bg-black/20"
                >ПАС</div>
                <div class="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white">
                  <div class="flex items-baseline gap-2">
                    <span class="text-[24px] sm:text-[26px] font-black leading-none">{{ s.exiting.value.card.name }}</span>
                    <span class="text-lg sm:text-xl font-bold opacity-90">{{ s.ageLabel(s.exiting.value.card) }}</span>
                  </div>
                </div>
              </div>
              <Button
                icon="pi pi-bars"
                rounded
                aria-label="Меню свайпов"
                title="Лента · Активные · Избранное · Лайки · Анкета · PRO"
                class="sm:hidden !absolute !top-11 !right-4 !z-30 !w-10 !h-10 !p-0 !rounded-full !bg-black/45 !border-0 !text-white backdrop-blur active:!scale-95"
                @pointerdown.stop
                @click="mobileMenu.open()"
              />
            </div>
            </div>

            <div v-else class="rounded-[24px] border border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white grid place-items-center"><i class="pi pi-heart-fill text-xl" /></div>
              <template v-if="s.feedExhausted.value && !s.hasActiveFilters.value">
                <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Ты просвайпал(а) всех в ULove 🎉</div>
                <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Лайкнутые сохранены в «Избранном». Новые люди появляются каждый день — загляни позже.</div>
                <div class="mt-4 flex gap-2 justify-center flex-wrap">
                  <Button label="Моё избранное" rounded size="small" class="!bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0 !text-white" @click="s.goTab('favorites')" />
                  <Button label="Обновить" severity="secondary" rounded outlined size="small" @click="s.loadFeed()" />
                  <Button v-if="s.canResetHistory.value" :label="s.isAdmin.value ? 'Сбросить просмотренные' : 'Начать заново (1 раз)'" icon="pi pi-trash" severity="warn" rounded outlined size="small" :loading="s.resetting.value" @click="s.resetHistory()" />
                </div>
                <div v-if="!s.canResetHistory.value" class="mt-2 text-[11px] text-stone-400 dark:text-zinc-500">Одноразовый сброс уже использован</div>
              </template>
              <template v-else>
                <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Лента пуста</div>
                <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Попробуй смягчить фильтры или загляни позже.</div>
                <div class="mt-4 flex gap-2 justify-center flex-wrap">
                  <Button label="Сбросить фильтры" severity="secondary" rounded outlined size="small" @click="s.resetFilters()" />
                  <Button label="Обновить" rounded size="small" @click="s.loadFeed()" />
                </div>
              </template>
            </div>
          </div>

          <div v-if="s.current.value" class="mt-2 hidden sm:flex items-center justify-center gap-2.5 sm:gap-4 pb-[var(--sab)]">
            <Button icon="pi pi-heart-fill" rounded raised aria-label="Лайк" class="!w-[72px] !h-[72px] sm:!w-20 sm:!h-20 !text-2xl sm:!text-3xl !text-white !bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0" :loading="s.acting.value" @click="s.swipe('like')" />
            <Button icon="pi pi-send" severity="info" rounded raised aria-label="Написать" class="!w-14 !h-14 sm:!w-16 sm:!h-16 !text-xl sm:!text-2xl" :loading="s.creatingChat.value" @click="s.writeWithoutMatch(s.current.value.id)" />
          </div>

          <Link href="/map" class="mt-5 hidden sm:flex items-center gap-3 rounded-[20px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft">
            <span class="w-11 h-11 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-300 grid place-items-center shrink-0"><i class="pi pi-map text-lg" /></span>
            <span class="min-w-0 flex-1 text-center">
              <span class="block text-sm font-black text-stone-900 dark:text-white">Карта рядом усиливает знакомства</span>
              <span class="block text-xs text-stone-500 dark:text-zinc-400">Смотри, кто гуляет поблизости, и ставь пины-встречи.</span>
            </span>
            <i class="pi pi-chevron-right ml-auto text-stone-300 dark:text-zinc-600 shrink-0" />
          </Link>
          </template>

          <Drawer
            :visible="mobileMenu.isOpen.value"
            position="right"
            class="!w-[78vw] !max-w-[300px]"
            :pt="{ header: { class: '!pb-2' }, content: { class: '!pt-1' } }"
            @update:visible="(v:boolean) => { v ? mobileMenu.open() : mobileMenu.close() }"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <span class="w-9 h-9 rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400 grid place-items-center text-white shadow-lg shadow-rose-500/30"><i class="pi pi-heart-fill" /></span>
                <span>
                  <span class="block text-[20px] font-black leading-none tracking-[-0.03em] bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent">ULove</span>
                  <span class="mt-0.5 block text-[11px] leading-none text-stone-400 dark:text-zinc-500">дейтинг внутри UPin</span>
                </span>
              </div>
            </template>
            <div class="flex flex-col gap-1.5 pt-1">
              <Button label="Лента" rounded :outlined="s.activeTab.value !== 'feed'" class="w-full !justify-start" :class="s.activeTab.value === 'feed' ? '!bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0 !text-white !shadow-lg !shadow-rose-500/25' : ''" @click="mobileMenu.selectTab(s, 'feed')">
                <template #icon>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><rect x="7" y="4" width="10" height="16" rx="2.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.5 12H5m-2.5 0L4 10.5M2.5 12L4 13.5M21.5 12H19m2.5 0L20 10.5m1.5 1.5L20 13.5" /></svg>
                </template>
              </Button>
              <Button label="Активные · онлайн" icon="pi pi-users" rounded :outlined="s.activeTab.value !== 'active'" class="w-full !justify-start" :class="s.activeTab.value === 'active' ? '!bg-gradient-to-br !from-emerald-500 !to-teal-500 !border-0 !text-white !shadow-lg !shadow-emerald-500/25' : ''" @click="mobileMenu.selectTab(s, 'active')" />
              <Button :label="`Избранное · ${s.favoritesCount.value}/${s.favoritesLimit.value}`" icon="pi pi-star" rounded :outlined="s.activeTab.value !== 'favorites'" class="w-full !justify-start" :class="s.activeTab.value === 'favorites' ? '!bg-gradient-to-br !from-amber-400 !to-orange-500 !border-0 !text-white !shadow-lg !shadow-amber-500/25' : ''" @click="mobileMenu.selectTab(s, 'favorites')" />
              <Button :label="`Лайки мне · ${s.admirersTotal.value}`" icon="pi pi-heart" rounded :outlined="s.activeTab.value !== 'admirers'" class="w-full !justify-start" :class="s.activeTab.value === 'admirers' ? '!bg-gradient-to-br !from-fuchsia-500 !to-rose-500 !border-0 !text-white !shadow-lg !shadow-fuchsia-500/25' : ''" @click="mobileMenu.selectTab(s, 'admirers')" />
              <Button label="Анкета · моя" icon="pi pi-user-edit" rounded :outlined="s.activeTab.value !== 'questionnaire'" class="w-full !justify-start" :class="s.activeTab.value === 'questionnaire' ? '!bg-gradient-to-br !from-violet-500 !to-fuchsia-500 !border-0 !text-white !shadow-lg !shadow-violet-500/25' : ''" @click="mobileMenu.selectTab(s, 'questionnaire')" />
              <Button label="PRO · плюшки" icon="pi pi-crown" rounded :outlined="s.activeTab.value !== 'premium'" class="w-full !justify-start" :class="s.activeTab.value === 'premium' ? '!bg-gradient-to-br !from-amber-400 !to-orange-500 !border-0 !text-white !shadow-lg !shadow-amber-500/25' : ''" @click="mobileMenu.selectTab(s, 'premium')" />
            </div>
            <div v-if="s.matches.value.length" class="mt-4">
              <div class="px-1 mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500"><i class="pi pi-heart-fill text-[10px] text-emerald-500" />Мэтчи · чат открыт</div>
              <button
                v-for="m in s.matches.value"
                :key="m.match_id"
                type="button"
                class="w-full flex items-center gap-2.5 p-1.5 rounded-2xl hover:bg-stone-100 dark:hover:bg-zinc-800 active:scale-[0.99] transition text-left"
                @click="mobileMenu.openMatch(s, m)"
              >
                <span class="relative shrink-0">
                  <Avatar :image="m.user.avatar_url ?? undefined" :label="!m.user.avatar_url ? (m.user.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-11 !h-11 ring-2 ring-emerald-400 dark:ring-emerald-500" />
                  <span class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 grid place-items-center ring-2 ring-white dark:ring-zinc-900"><i class="pi pi-heart-fill text-white text-[8px]" /></span>
                </span>
                <span class="min-w-0 flex-1 text-sm font-bold truncate text-stone-800 dark:text-zinc-100">{{ m.user.name }}</span>
                <i class="pi pi-chevron-right text-stone-300 dark:text-zinc-600 text-xs shrink-0" />
              </button>
            </div>
            <div class="mt-4">
              <div class="px-1 mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500"><i class="pi pi-sliders-h text-[10px] text-fuchsia-500" />Панель</div>
              <div class="mb-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500/10 to-orange-400/10 border border-rose-200/70 dark:border-rose-900/60 px-3 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-300"><i class="pi pi-send text-[10px]" />{{ s.quotaLabel.value }}</div>
              <div class="flex flex-col gap-1.5">
                <Button label="Фильтры" icon="pi pi-sliders-h" rounded outlined size="small" class="w-full !justify-start" @click="mobileMenu.openFilters(s)" />
                <Button label="Как работают свайпы" icon="pi pi-question-circle" rounded outlined size="small" class="w-full !justify-start" @click="mobileMenu.openHelp(s)" />
              </div>
            </div>
          </Drawer>
        </template>
      </div>

      <Dialog :visible="s.showFilters.value" @update:visible="(v:boolean)=>{ s.showFilters.value = v }" modal header="Фильтры и приватность" :style="{ width: '440px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <div class="flex flex-col gap-4 pt-1 min-w-0">
          <div class="min-w-0">
            <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Что ищешь</label>
            <Select v-model="s.filters.value.goal" :options="goalOptions" option-label="label" option-value="value" placeholder="Любая цель" class="w-full mt-1 dark:!border-zinc-700" :pt="selectPt" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="min-w-0">
              <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Кого показать</label>
              <Select v-model="s.filters.value.gender" :options="genderOptions" option-label="label" option-value="value" class="w-full mt-1 dark:!border-zinc-700" :pt="selectPt" />
            </div>
            <div class="min-w-0">
              <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Люди рядом</label>
              <Select v-model="s.filters.value.radius_km" :options="radiusOptions" option-label="label" option-value="value" placeholder="Все люди" class="w-full mt-1 dark:!border-zinc-700" :pt="selectPt" />
              <div class="mt-1 text-[11px] text-stone-500 dark:text-zinc-400">Без фильтра — все люди в системе. Free: рядом до 10 км, дальше — PRO.</div>
              <div v-if="s.isRadiusPro(s.filters.value.radius_km)" class="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">Выбранный радиус — PRO. Оформи PRO, чтобы листать дальше.</div>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="min-w-0">
              <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Возраст от</label>
              <InputText v-model="s.ageMinText.value" type="number" inputmode="numeric" min="18" max="99" placeholder="18" class="w-full mt-1 dark:!border-zinc-700" />
            </div>
            <div class="min-w-0">
              <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Возраст до</label>
              <InputText v-model="s.ageMaxText.value" type="number" inputmode="numeric" min="18" max="99" placeholder="99" class="w-full mt-1 dark:!border-zinc-700" />
            </div>
          </div>
          <div>
            <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Интересы</label>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <Chip
                v-for="t in interestTags"
                :key="t"
                :label="`#${t}`"
                class="!rounded-full cursor-pointer text-xs"
                :style="s.filters.value.interests.includes(t) ? '' : 'opacity:.55'"
                @click="s.toggleInterest(t)"
              />
            </div>
          </div>
          <div class="rounded-2xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800/60 p-3 flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <ToggleSwitch class="shrink-0" v-model="s.privacy.value.dating_match_only" input-id="match-only" />
              <label for="match-only" class="text-sm text-stone-700 dark:text-zinc-200">Писать могут только мэтчи <span class="text-stone-400 dark:text-zinc-500">(базовая приватность, бесплатно)</span></label>
            </div>
            <div class="flex items-center gap-3 opacity-80">
              <ToggleSwitch class="shrink-0" v-model="s.privacy.value.dating_hide_name" input-id="hide-name" />
              <label for="hide-name" class="text-sm text-stone-700 dark:text-zinc-200">Скрыть имя <span class="text-amber-500 font-bold">PRO</span></label>
            </div>
            <div class="flex items-center gap-3 opacity-80">
              <ToggleSwitch class="shrink-0" v-model="s.privacy.value.dating_hide_age" input-id="hide-age" />
              <label for="hide-age" class="text-sm text-stone-700 dark:text-zinc-200">Скрыть возраст <span class="text-amber-500 font-bold">PRO</span></label>
            </div>
            <Button label="Сохранить приватность" severity="secondary" size="small" rounded outlined :loading="s.savingPrivacy.value" @click="s.savePrivacy()" />
          </div>
          <div class="flex gap-2 pb-[var(--sab)]">
            <Button label="Сбросить" severity="secondary" outlined rounded class="flex-1" :loading="s.loading.value" @click="s.resetFilters()" />
            <Button label="Показать" rounded class="flex-1" :loading="s.loading.value" @click="s.applyFilters()" />
          </div>
        </div>
      </Dialog>

      <Dialog :visible="!!s.matchedCard.value" @update:visible="(v:boolean)=>{ if(!v) s.closeMatch() }" modal :closable="true" :draggable="false" :style="{ width: '380px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <div class="text-center py-2">
          <div class="text-4xl">💞</div>
          <div class="mt-2 text-2xl font-black text-stone-900 dark:text-white">Это мэтч!</div>
          <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">{{ s.matchedCard.value?.name }} тоже лайкнул тебя. Комната уже создана — чат открыт даже при исчерпанном лимите.</div>
          <Avatar :image="s.matchedCard.value?.avatar_url ?? undefined" :label="!s.matchedCard.value?.avatar_url ? (s.matchedCard.value?.name ?? '?').slice(0,1) : undefined" shape="circle" size="xlarge" class="!w-20 !h-20 mx-auto mt-4 ring-4 ring-rose-300 dark:ring-rose-800" />
          <div class="mt-5 flex gap-2 justify-center flex-wrap">
            <Button label="Продолжить листать" severity="secondary" rounded outlined @click="s.closeMatch()" />
            <Button label="Перейти в чат" icon="pi pi-send" rounded :loading="s.creatingChat.value" @click="s.matchedCard.value && s.openChat(s.matchedCard.value.id, s.matchedConversationId.value)" />
          </div>
        </div>
      </Dialog>

      <SwipeDetailsDialog :card="detailsCard" @close="detailsCard = null" />

      <Dialog :visible="s.showHelp.value" @update:visible="(v:boolean)=>{ s.showHelp.value = v }" modal header="Как работают свайпы" :style="{ width: '420px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <div class="flex flex-col gap-3 text-sm text-stone-600 dark:text-zinc-300 pt-1">
          <div>Лента — без geo-ограничений: листай всех людей в системе, не важно где они находятся.</div>
          <div>Фильтр «Люди рядом» — опционален. Free: рядом до 10 км, всё дальше — PRO безлимит.</div>
          <div>Свайпы безлимитные. Сообщения без мэтча: Free {{ s.quota.value ? `${s.quota.value.left}/${s.quota.value.limit}` : '3/3' }}, PRO — 10/мес. Взаимный лайк (мэтч) открывает чат всегда, даже при исчерпанном лимите.</div>
          <div>Избранное — лайкнутые без мэтча. Лимиты: Free до 2, Pro до 5, Business до 15.</div>
          <div>Просвайпанных можно вернуть один раз кнопкой «Начать заново» — лента снова покажет всех. Админу сброс доступен безлимитно.</div>
          <div>Таб «Активные» — кто сейчас в ULove. Открывай анкету, пиши, если человек не закрыл сообщения.</div>
          <div>Кнопка ⓘ на карточке — подробная анкета: что ищет, интересы, о себе. Своя анкета — иконка-карандаш сверху.</div>
          <div class="rounded-2xl bg-stone-100 dark:bg-zinc-800 px-3 py-2 text-center font-bold">Строго 18+</div>
        </div>
      </Dialog>

      <Dialog :visible="s.showPaywall.value" @update:visible="(v:boolean)=>{ if(!v) s.closePaywall() }" modal header="Нужен PRO" :style="{ width: '380px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <div class="text-center py-2">
          <div class="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white grid place-items-center"><i class="pi pi-crown text-xl" /></div>
          <div class="mt-3 text-lg font-black text-stone-900 dark:text-white">«{{ s.paywallFeature.value }}» — PRO-плюшка</div>
          <p class="mt-1 text-sm text-stone-500 dark:text-zinc-400">Твой тариф: {{ s.planLabel.value }}. Оформи подписку PRO, чтобы включить.</p>
          <div class="mt-4 flex gap-2 justify-center flex-wrap">
            <Button label="Понятно" severity="secondary" rounded outlined @click="s.closePaywall()" />
            <Link href="/settings"><Button label="Выбрать тариф" icon="pi pi-crown" rounded class="!bg-gradient-to-br !from-amber-400 !to-orange-500 !border-0 !text-white" /></Link>
          </div>
        </div>
      </Dialog>

      <Dialog :visible="s.ageGate.value" modal :closable="false" :draggable="false" header="Только 18+" :style="{ width: '400px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <div class="pt-1">
          <div class="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white grid place-items-center text-lg font-black">18+</div>
          <div class="mt-3 text-center text-lg font-black text-stone-900 dark:text-white">Подтверди возраст</div>
          <p class="mt-1 text-center text-sm text-stone-500 dark:text-zinc-400">Приложением можно пользоваться свободно, но свайпы — строго с 18 лет. Укажи дату рождения один раз, изменить её будет нельзя.</p>
          <template v-if="s.ageGateReason.value === 'missing'">
            <label class="mt-4 block text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Дата рождения</label>
            <DatePicker v-model="s.birthDate.value" date-format="dd.mm.yy" placeholder="12.07.1997" manual-input show-icon fluid :max-date="s.adultMaxDate.value" class="w-full mt-1 dark:[&_.p-inputtext]:!border-zinc-700" />
            <div v-if="s.error.value" class="mt-2 text-sm text-rose-600 dark:text-rose-300">{{ s.error.value }}</div>
            <Button label="Мне есть 18 — открыть свайпы" icon="pi pi-check" rounded class="w-full mt-4" :loading="s.verifying.value" :disabled="!s.birthDate.value" @click="s.verifyAge()" />
          </template>
          <template v-else>
            <div class="mt-4 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 text-center">По указанной дате рождения тебе ещё нет 18. Свайпы откроются автоматически, остальное приложение доступно уже сейчас.</div>
            <Link href="/map" class="mt-4 block"><Button label="Перейти на карту" icon="pi pi-map" rounded outlined class="w-full" /></Link>
          </template>
        </div>
      </Dialog>
    </div>
  </component>
</template>

<style scoped>
.touch-pan-y {
  touch-action: pan-y;
}
.swipe-deck {
  perspective: 1200px;
}
.swipe-top {
  will-change: transform, opacity;
  user-select: none;
  -webkit-user-select: none;
}
.swipe-top img {
  pointer-events: none;
}
.story-fill {
  width: 0%;
  animation-name: story-fill;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes story-fill {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}
.fly-card {
  will-change: transform, opacity;
  animation-duration: 0.38s;
  animation-timing-function: cubic-bezier(0.2, 0.7, 0.25, 1);
  animation-fill-mode: forwards;
}
.fly-like {
  animation-name: fly-like;
}
.fly-pass {
  animation-name: fly-pass;
}
@keyframes fly-like {
  from {
    transform: translate(var(--from-x, 0px), var(--from-y, 0px)) rotate(8deg);
    opacity: 1;
  }
  to {
    transform: translate(110vw, 140px) rotate(30deg);
    opacity: 0;
  }
}
@keyframes fly-pass {
  from {
    transform: translate(var(--from-x, 0px), var(--from-y, 0px)) rotate(-8deg);
    opacity: 1;
  }
  to {
    transform: translate(-110vw, 140px) rotate(-30deg);
    opacity: 0;
  }
}</style>
