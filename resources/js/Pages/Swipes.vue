<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import DatingQuestionnaireForm from '@/Components/Features/Dating/DatingQuestionnaireForm.vue'
import SwipeDetailsDialog from '@/Components/Features/Dating/SwipeDetailsDialog.vue'
import SwipeActionsBar from '@/Components/Features/Dating/SwipeActionsBar.vue'
import MatchSplash from '@/Components/Features/Dating/MatchSplash.vue'
import AppImage from '@/Components/Ui/Media/AppImage.vue'
import { useSwipes } from '@/composables/useSwipes'
import InfiniteSentinel from '@/Components/Ui/List/InfiniteSentinel.vue'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { useSwipeCardPhotos } from '@/composables/useSwipeCardPhotos'
import { useSwipeStamps } from '@/composables/useSwipeStamps'
import { useSwipesMobileMenu } from '@/composables/useSwipesMobileMenu'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'
import { useProfileUrl } from '@/composables/useProfileUrl'
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

const s = useSwipes()
const cardPhotos = useSwipeCardPhotos(() => s.current.value)
const stamps = useSwipeStamps(s.dragX)
const mobileMenu = useSwipesMobileMenu()
const { selectPt } = useDropdownMenuStyle()
const { userProfileUrl } = useProfileUrl()

const detailsCard = ref<any | null>(null)
const activeHasMore = computed(() => s.activeHasMore.value)
const activeLoadingMore = computed(() => s.loadingMoreLists.value)
const { sentinel: activeSentinel } = useInfiniteScroll({ hasMore: activeHasMore, loading: activeLoadingMore, onLoadMore: () => s.loadMoreActive() })
const favHasMore = computed(() => s.favoritesHasMore.value)
const { sentinel: favSentinel } = useInfiniteScroll({ hasMore: favHasMore, loading: activeLoadingMore, onLoadMore: () => s.loadMoreFavorites() })
const admHasMore = computed(() => s.admirersHasMore.value)
const { sentinel: admSentinel } = useInfiniteScroll({ hasMore: admHasMore, loading: activeLoadingMore, onLoadMore: () => s.loadMoreAdmirers() })
const matchHasMore = computed(() => s.matchesHasMore.value)
const { sentinel: matchSentinel } = useInfiniteScroll({ hasMore: matchHasMore, loading: activeLoadingMore, onLoadMore: () => s.loadMoreMatches() })

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

/**
 * Свайп с клавиатуры (ULove-режим, ←/→): листает только ленту
 * при готовой карточке, иначе игнорируется.
 */
function onKeyboardSwipe(event: Event): void {
  const dir = (event as CustomEvent).detail

  if (dir !== 'like' && dir !== 'pass') {
    return
  }

  if (s.activeTab.value !== 'feed' || s.loading.value || !s.current.value || s.acting.value) {
    return
  }

  void s.swipe(dir)
}

onMounted(async () => {
  try {
    window.addEventListener('ulove:swipe', onKeyboardSwipe)
  } catch {}

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

onUnmounted(() => {
  try {
    window.removeEventListener('ulove:swipe', onKeyboardSwipe)
  } catch {}

  try {
    ;(window as any).__swipesRealtimeStop?.()
    ;(window as any).__swipesRealtimeStop = null
  } catch {}
})
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
  </Head>
  <div class="w-full min-w-0 bg-transparent" :class="s.activeTab.value === 'feed' ? 'swipes-feed-lock' : 'page-scroll swipes-tab-scroll scroll-neat'">
      <div class="w-full min-w-0 mx-auto max-w-[640px] px-4 sm:px-6" :class="s.activeTab.value === 'feed' ? 'swipes-feed-inner pt-2 sm:py-6 sm:pb-[calc(2rem+var(--sab))]' : 'pt-3 pb-1 sm:py-6 sm:pb-[calc(2rem+var(--sab))]'">

        <h1 class="sr-only">ULove — знакомства рядом</h1>
        <div class="flex items-center px-1 py-2 shrink-0">
          <Button icon="pi pi-user" rounded text aria-label="Мой профиль" title="Мой профиль" class="!w-10 !h-10 !p-0 shrink-0 !text-stone-400 dark:!text-zinc-500 hover:!text-stone-600 dark:hover:!text-zinc-300 [&_.p-button-icon]:!text-xl" @click="mobileMenu.goProfile()" />
          <Button v-if="isAuth && s.showTabBack.value" icon="pi pi-arrow-left" rounded text aria-label="Назад к ленте" title="Назад к ленте" class="!w-10 !h-10 !p-0 shrink-0 !text-stone-400 dark:!text-zinc-500 hover:!text-stone-600 dark:hover:!text-zinc-300 [&_.p-button-icon]:!text-xl" @click="s.backToFeed()" />
          <span v-else-if="isAuth" class="w-10 shrink-0" aria-hidden="true" />
          <span class="flex-1" />
          <button type="button" class="grid place-items-center w-11 h-11 rounded-full active:scale-90 transition" aria-label="ULove — к ленте" title="К ленте" @click="isAuth && s.goTab('feed')">
            <span class="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[#FD267D] to-[#FF7854] grid place-items-center text-white shadow-md shadow-rose-500/40"><i class="pi pi-heart-fill text-lg" /></span>
          </button>
          <span class="flex-1" />
          <Link v-if="isAuth" href="/chat"><Button icon="pi pi-comments" rounded text aria-label="Сообщения" title="Сообщения" class="!w-10 !h-10 !p-0 shrink-0 !text-stone-400 dark:!text-zinc-500 hover:!text-stone-600 dark:hover:!text-zinc-300 [&_.p-button-icon]:!text-xl" /></Link>
          <Button v-if="isAuth" icon="pi pi-bars" rounded text aria-label="Меню ULove" title="Лента · Онлайн · Избранное · Лайки · Анкета · PRO" class="!w-10 !h-10 !p-0 shrink-0 !text-stone-400 dark:!text-zinc-500 hover:!text-stone-600 dark:hover:!text-zinc-300 [&_.p-button-icon]:!text-xl" @click="mobileMenu.open()" />
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
          <div class="mt-2 sm:mt-4 hidden sm:flex items-center gap-2">
            <Chip :label="s.quotaLabel.value" icon="pi pi-send" class="!rounded-full" />
            <Chip v-if="s.isQuotaEmpty.value" label="Лимит исчерпан — мэтчи пишут бесплатно" icon="pi pi-heart-fill" class="!rounded-full !bg-rose-100 !text-rose-700 dark:!bg-rose-950 dark:!text-rose-300 dark:!border dark:!border-rose-900" />
            <span class="flex-1" />
            <Button icon="pi pi-user-edit" severity="secondary" rounded outlined size="small" aria-label="Моя анкета" title="Моя анкета — что ищешь, о себе, интересы" @click="s.goTab('questionnaire')" />
            <Button icon="pi pi-question-circle" severity="secondary" rounded outlined size="small" aria-label="Как работают свайпы" title="Как работают свайпы" @click="s.showHelp.value = true" />
            <Button icon="pi pi-sliders-h" severity="secondary" rounded outlined size="small" aria-label="Фильтры" @click="s.showFilters.value = true" />
            <Button v-if="s.canResetHistory.value" icon="pi pi-trash" severity="warn" rounded outlined size="small" aria-label="Сбросить просмотренные" :title="s.resetTitle.value" :loading="s.resetting.value" @click="s.resetHistory()" />
          </div>

          <div v-if="s.matches.value.length" class="mt-4 hidden sm:block">
            <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 mb-2">Мэтчи · чат открыт</div>
            <div class="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-1 px-1">
              <button
                v-for="m in s.matches.value"
                :key="m.match_id"
                type="button"
                class="flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 active:scale-95 transition"
                @click="s.openChat(m.user.id, m.conversation_id)"
              >
                <span class="block rounded-full bg-gradient-to-br from-[#FD267D] to-[#FF7854] p-[2.5px]">
                  <Avatar :image="m.user.avatar_url ?? undefined" :label="!m.user.avatar_url ? (m.user.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!block !h-14 !w-14 overflow-hidden !text-xl !border-2 !border-white dark:!border-zinc-900" />
                </span>
                <span class="w-full truncate text-center text-[11px] font-semibold leading-tight text-stone-600 dark:text-zinc-200">{{ m.user.name }}</span>
              </button>
            </div>
          </div>

          <div v-if="s.error.value" class="mt-3 text-sm text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl px-4 py-3">
            {{ s.error.value }}
          </div>

          <div v-if="s.boostActive.value" class="mt-3 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-[13px] font-black text-white shadow-soft">
            <i class="pi pi-bolt" /><span>Буст активен {{ s.boostUntilLabel.value }} — тебя видят первым</span>
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
                  :key="u.id ?? u.name"
                  class="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex flex-col items-center text-center"
                >
                  <Link :href="userProfileUrl(u)" class="relative shrink-0">
                    <Avatar :image="u.avatar_url ?? undefined" :label="!u.avatar_url ? (u.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-16 !h-16" />
                    <span class="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" title="В сети" />
                  </Link>
                  <Link :href="userProfileUrl(u)" class="mt-2 min-w-0 w-full">
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
              <InfiniteSentinel :sentinel="activeSentinel" :has-more="s.activeHasMore.value" :loading="s.loadingMoreLists.value" />
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
                :key="f.id ?? f.name"
                class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
              >
                <Link :href="userProfileUrl(f)" class="shrink-0"><Avatar :image="f.avatar_url ?? undefined" :label="!f.avatar_url ? (f.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!w-12 !h-12" /></Link>
                <Link :href="userProfileUrl(f)" class="min-w-0 flex-1">
                  <div class="text-sm font-bold truncate text-stone-900 dark:text-white">{{ f.name }}<span class="font-semibold text-stone-500 dark:text-zinc-400"> · {{ s.ageLabel(f) }}</span></div>
                  <div v-if="f.city" class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ f.city }}</div>
                </Link>
                <Button icon="pi pi-send" rounded size="small" aria-label="Написать" title="Написать" :loading="s.creatingChat.value" class="!w-10 !h-10 !p-0 shrink-0" @click="s.writeWithoutMatch(f.id)" />
                <Button icon="pi pi-times" rounded size="small" severity="secondary" outlined aria-label="Убрать" title="Убрать из избранного" class="!w-10 !h-10 !p-0 shrink-0" @click="s.removeFavorite(f.id)" />
              </div>
              <div class="text-center text-[11px] text-stone-400 dark:text-zinc-500">Занято {{ s.favoritesCount.value }} из {{ s.favoritesLimit.value }} · Free: до 3 · Pro: до 5</div>
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
                :key="s.admirerKey(f)"
                class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
              >
                <component :is="f.is_incognito ? 'span' : Link" :href="f.is_incognito ? undefined : userProfileUrl(f)" class="shrink-0">
                  <Avatar :image="(!f.is_incognito && f.avatar_url) ? f.avatar_url : undefined" :label="f.is_incognito ? '🕵️' : (!f.avatar_url ? (f.name ?? '?').slice(0, 1) : undefined)" shape="circle" class="!w-12 !h-12" />
                </component>
                <component :is="f.is_incognito ? 'span' : Link" :href="f.is_incognito ? undefined : userProfileUrl(f)" class="min-w-0 flex-1">
                  <div class="text-sm font-bold truncate text-stone-900 dark:text-white">{{ f.is_incognito ? 'Тайный поклонник' : f.name }}<span v-if="!f.is_incognito" class="font-semibold text-stone-500 dark:text-zinc-400"> · {{ s.ageLabel(f) }}</span></div>
                  <div v-if="f.is_incognito" class="text-[11px] text-violet-500 font-bold">Скрыл себя · PRO · лайкни в ответ — откроется при мэтче</div>
                  <div v-else-if="f.city" class="text-[11px] text-stone-500 dark:text-zinc-400 truncate">{{ f.city }}</div>
                </component>
                <Chip v-if="f.is_superlike" label="Суперлайк" icon="pi pi-star-fill" class="!rounded-full !text-[10px] !bg-[#1786FF] !text-white !border-0" />
                <Chip v-if="f.liked_me || f.is_match" label="Взаимно" icon="pi pi-heart-fill" class="!rounded-full !text-[10px]" />
                <Button v-if="!f.is_incognito" icon="pi pi-heart-fill" rounded size="small" aria-label="Лайк в ответ" title="Лайк в ответ" :loading="s.acting.value && s.actingId.value === f.id" class="!w-10 !h-10 !p-0 shrink-0" @click="s.swipeAdmirer(f.id)" />
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
                  <div class="text-xs text-white/80">Твой тариф: {{ s.planLabel.value }}<span v-if="s.planExpiresLabel.value"> · {{ s.planExpiresLabel.value }}</span></div>
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
                <span class="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-300 grid place-items-center shrink-0"><i class="pi pi-send" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Скрыть расстояние <span class="text-amber-500">PRO</span></div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ s.privacy.value.dating_hide_distance ? 'Расстояние скрыто · виден только город' : 'Все видят расстояние до тебя' }}</div>
                </div>
                <ToggleSwitch class="shrink-0" :model-value="s.privacy.value.dating_hide_distance" input-id="premium-hide-distance" @update:model-value="(v:boolean)=>s.setPrivacyFlag('dating_hide_distance', v)" />
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
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Free — до 3 · Pro — до 5 · Business — до 15</div>
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
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Free — до 5 фото · фото добавляют в профиле</div>
                </div>
                <Link href="/profile"><Button label="Фото" icon="pi pi-camera" rounded outlined size="small" /></Link>
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-500 grid place-items-center shrink-0"><i class="pi pi-refresh" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Начать заново</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ s.resetDescription.value }}</div>
                </div>
                <Button v-if="s.canResetHistory.value" :label="(s.isAdmin.value || s.isPro.value) ? 'Сбросить' : 'Сбросить (1 раз)'" icon="pi pi-trash" severity="warn" rounded outlined size="small" :loading="s.resetting.value" @click="s.resetHistory()" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-sky-500/15 text-[#1786FF] grid place-items-center shrink-0"><i class="pi pi-star-fill" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Суперлайки · осталось {{ s.leftLabel(s.superlikesLeft.value) }}</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Free — 1/день · PRO — 5/день · пак +5 — отдельная покупка</div>
                </div>
                <Button label="Пак +5" icon="pi pi-plus" rounded outlined size="small" :loading="s.buyingExtras.value" @click="s.purchaseExtras('superlike_pack')" />
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 grid place-items-center shrink-0"><i class="pi pi-bolt" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">{{ s.boostActive.value ? `Буст активен ${s.boostUntilLabel.value}` : 'Буст профиля · 30 мин в топе' }}</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">{{ s.boostActive.value ? 'Твоя анкета летит первой в чужих лентах' : `Куплено: ${s.extras.value.boosts_balance} · PRO — 1 в месяц бесплатно` }}</div>
                </div>
                <div class="flex gap-1.5 shrink-0">
                  <Button v-if="!s.boostActive.value" label="Включить" icon="pi pi-bolt" rounded size="small" :loading="s.buyingExtras.value" @click="s.activateBoost()" />
                  <Button label="+1" icon="pi pi-plus" rounded outlined size="small" :loading="s.buyingExtras.value" @click="s.purchaseExtras('boost')" />
                </div>
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                <span class="w-10 h-10 rounded-2xl bg-yellow-500/15 text-[#FFC629] grid place-items-center shrink-0"><i class="pi pi-undo" /></span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-black text-stone-900 dark:text-white">Откат свайпа · осталось {{ s.leftLabel(s.undosLeft.value) }}</div>
                  <div class="text-[11px] text-stone-500 dark:text-zinc-400">Free — 1/день · PRO — безлимит · откат — в боковом меню</div>
                </div>
                <Button label="К ленте" icon="pi pi-images" rounded outlined size="small" @click="s.goTab('feed')" />
              </div>
            </div>
          </template>

          <template v-else>
          <div class="swipes-feed mt-1 sm:mt-4 relative select-none overscroll-none sm:max-w-[420px] sm:mx-auto sm:w-full">
            <div v-if="s.loading.value" class="swipes-feed-skeleton rounded-xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 grid place-items-center sm:h-[62dvh] sm:min-h-[400px] sm:max-h-[540px]">
              <i class="pi pi-spin pi-spinner text-2xl text-stone-400 dark:text-zinc-500" />
            </div>

            <div v-else-if="s.current.value" class="swipes-card-wrap">
              <div class="swipe-deck relative overscroll-none sm:h-[62dvh] sm:min-h-[400px] sm:max-h-[540px]">
              <div
                v-if="s.next.value"
                class="absolute inset-0 z-0 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-soft pointer-events-none"
                :style="s.stackCardStyle.value"
              >
                <AppImage
                  v-if="s.next.value.photos[0]"
                  :src="s.next.value.photos[0]"
                  alt=""
                  class="absolute inset-0"
                  img-class="absolute inset-0 w-full h-full object-cover"
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
                class="swipe-top absolute inset-0 z-10 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-soft touch-pan-y overscroll-contain cursor-grab active:cursor-grabbing"
                :style="s.topCardStyle.value"
                @pointerdown="s.dragStart($event.clientX, $event.clientY)"
                @pointermove="s.dragMove($event.clientX, $event.clientY)"
                @pointerup="s.dragEnd()"
                @pointercancel="s.dragEnd()"
                @pointerleave="s.dragEnd()"
              >
                <div class="absolute top-5 left-4 z-30 pointer-events-none px-3 py-1 rounded-lg border-4 border-[#21D07A] text-[#21D07A] text-[26px] font-black tracking-[0.08em] leading-none bg-black/10" :style="stamps.likeStyle.value">LIKE</div>
                <div class="absolute top-5 right-4 z-30 pointer-events-none px-3 py-1 rounded-lg border-4 border-[#FF4458] text-[#FF4458] text-[26px] font-black tracking-[0.08em] leading-none bg-black/10" :style="stamps.nopeStyle.value">NOPE</div>
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
                <AppImage
                  v-if="cardPhotos.currentPhoto.value"
                  :src="cardPhotos.currentPhoto.value"
                  :key="`${s.current.value.id}-${cardPhotos.photoIndex.value}`"
                  alt=""
                  :eager="true"
                  class="absolute inset-0"
                  img-class="absolute inset-0 w-full h-full object-cover"
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

                <div v-if="s.current.value.liked_me" class="absolute top-14 left-4 z-30 pointer-events-none flex flex-col items-start gap-1.5">
                  <span class="inline-flex items-center gap-1 rounded-full bg-[#21D07A] px-2.5 py-1 text-[11px] font-black text-white shadow"><i class="pi pi-heart-fill text-[10px]" />Лайкнул тебя</span>
                  <span v-if="s.current.value.is_superlike" class="inline-flex items-center gap-1 rounded-full bg-[#1786FF] px-2.5 py-1 text-[11px] font-black text-white shadow"><i class="pi pi-star-fill text-[10px]" />Суперлайк</span>
                  <span v-if="s.current.value.is_boosted" class="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-black text-white shadow"><i class="pi pi-bolt text-[10px]" />В топе</span>
                </div>

                <div class="absolute bottom-0 inset-x-0 p-4 text-white pointer-events-none">
                  <div class="flex items-end gap-2">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-baseline gap-2">
                        <Link
                          v-if="s.current.value.id != null"
                          :href="userProfileUrl(s.current.value)"
                          class="text-[28px] font-bold leading-none truncate hover:underline pointer-events-auto"
                          title="Открыть профиль"
                          @pointerdown.stop
                        >{{ s.current.value.name }}</Link>
                        <span v-else class="text-[28px] font-bold leading-none truncate">{{ s.current.value.name }}</span>
                        <span class="text-[22px] font-light leading-none shrink-0">{{ s.ageLabel(s.current.value) }}</span>
                      </div>
                      <div class="mt-1.5 space-y-0.5 text-[15px] leading-snug text-white/95">
                        <div class="truncate">💘 {{ goalShort(s.current.value) }}</div>
                        <div v-if="s.current.value.city || s.current.value.distance_km != null" class="truncate">📍 {{ [s.current.value.city, s.current.value.distance_km != null ? `${s.current.value.distance_km} км` : null].filter(Boolean).join(' · ') }}</div>
                      </div>
                    </div>
                    <Button
                      icon="pi pi-info"
                      rounded
                      aria-label="Подробнее об анкете"
                      title="Подробнее — интересы, о себе"
                      class="!w-9 !h-9 !p-0 !rounded-full !bg-white !border-0 !text-stone-700 shadow shrink-0 pointer-events-auto active:!scale-95"
                      @pointerdown.stop
                      @click="detailsCard = s.current.value"
                    />
                  </div>
                  <div v-if="s.current.value.interests.length" class="mt-2 flex flex-wrap gap-1.5">
                    <span v-for="t in s.current.value.interests.slice(0, 4)" :key="t" class="rounded-full border border-white/40 px-2.5 py-1 text-xs font-semibold text-white">{{ t }}</span>
                  </div>
                </div>
              </div>

              <div
                v-if="s.exiting.value"
                class="fly-card absolute inset-0 z-20 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-soft pointer-events-none"
                :class="s.exiting.value.dir === 'right' ? 'fly-pass' : 'fly-like'"
                :style="{ '--from-x': `${s.exiting.value.fromX}px`, '--from-y': `${s.exiting.value.fromY}px` }"
              >
                <AppImage
                  v-if="s.exiting.value.card.photos[0]"
                  :src="s.exiting.value.card.photos[0]"
                  alt=""
                  :eager="true"
                  class="absolute inset-0"
                  img-class="absolute inset-0 w-full h-full object-cover"
                />
                <div v-else class="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400">
                  <span class="text-white text-7xl font-black">{{ (s.exiting.value.card.name ?? '?').slice(0, 1) }}</span>
                </div>
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div class="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white">
                  <div class="flex items-baseline gap-2">
                    <span class="text-[24px] sm:text-[26px] font-black leading-none">{{ s.exiting.value.card.name }}</span>
                    <span class="text-lg sm:text-xl font-bold opacity-90">{{ s.ageLabel(s.exiting.value.card) }}</span>
                  </div>
                </div>
              </div>
            </div>
            </div>

            <div v-else class="rounded-xl bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center shadow-soft">
              <div class="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white grid place-items-center shadow-lg shadow-rose-500/30"><i class="pi pi-heart-fill text-2xl" /></div>
              <template v-if="s.feedExhausted.value && !s.hasActiveFilters.value">
                <template v-if="s.isPro.value">
                  <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Ты просвайпал(а) всех текущих в ULove 🎉</div>
                  <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">PRO листает безлимитно: покажи всех снова — лента вернёт просвайпанных. Лайкнутые сохранены в «Избранном».</div>
                  <div class="mt-4 flex gap-2 justify-center flex-wrap">
                    <Button label="Моё избранное" rounded size="small" class="!bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0 !text-white" @click="s.goTab('favorites')" />
                    <Button label="Обновить" severity="secondary" rounded outlined size="small" @click="s.loadFeed()" />
                    <Button label="Показать снова" icon="pi pi-refresh" severity="warn" rounded outlined size="small" :loading="s.resetting.value" @click="s.resetHistory()" />
                  </div>
                </template>
                <template v-else>
                  <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Ты просвайпал(а) всех в ULove 🎉</div>
                  <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Лайкнутые сохранены в «Избранном». Новые люди появляются каждый день — загляни позже.</div>
                  <div class="mt-4 flex gap-2 justify-center flex-wrap">
                    <Button label="Моё избранное" rounded size="small" class="!bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0 !text-white" @click="s.goTab('favorites')" />
                    <Button label="Обновить" severity="secondary" rounded outlined size="small" @click="s.loadFeed()" />
                    <Button v-if="s.canResetHistory.value" label="Начать заново (1 раз)" icon="pi pi-trash" severity="warn" rounded outlined size="small" :loading="s.resetting.value" @click="s.resetHistory()" />
                  </div>
                  <div v-if="!s.canResetHistory.value" class="mt-2 text-[11px] text-stone-400 dark:text-zinc-500">Одноразовый сброс уже использован</div>
                </template>
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

          <SwipeActionsBar
            v-if="s.current.value"
            :acting="s.acting.value"
            :writing="s.creatingChat.value"
            :super-left="s.leftLabel(s.superlikesLeft.value)"
            @pass="s.swipe('pass')"
            @like="s.swipe('like')"
            @superlike="s.superlike()"
            @write="s.writeWithoutMatch(s.current.value.id)"
          />
          </template>

          <Drawer
            :visible="mobileMenu.isOpen.value"
            position="right"
            :show-close-icon="false"
            :block-scroll="true"
            class="ulove-drawer !w-[86vw] !max-w-[340px] sm:!w-[360px] sm:!max-w-[360px] !rounded-l-[28px] !rounded-r-none !overflow-hidden !border-0"
            :pt="{
              root: { class: '!bg-white dark:!bg-zinc-900 !border-0 !inset-y-0 !right-0 !mr-0 !ml-auto !h-dvh !max-h-dvh' },
              mask: { class: '!p-0 !m-0' },
              header: { class: '!p-0 !m-0 w-full !border-0 !bg-transparent' },
              title: { class: '!m-0 w-full max-w-full' },
              content: { class: '!p-0 !bg-transparent !overflow-y-auto overscroll-contain [overscroll-behavior:contain] [-webkit-overflow-scrolling:touch]' },
            }"
            @update:visible="(v:boolean) => { v ? mobileMenu.open() : mobileMenu.close() }"
          >
            <template #header>
              <div class="w-full max-w-full border-b border-stone-100 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 dark:border-zinc-800">
                <div class="flex w-full max-w-full items-center gap-2">
                  <span class="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white"><i class="pi pi-heart-fill text-sm" /></span>
                  <span class="text-lg font-black tracking-tight text-stone-900 dark:text-white">ULove</span>
                  <span class="ml-1 inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-zinc-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /><span class="truncate">{{ s.activeUsers.value.length }} онлайн</span></span>
                  <span class="flex-1" />
                  <Button icon="pi pi-times" rounded text aria-label="Закрыть меню" class="!h-9 !w-9 !p-0 shrink-0 !text-stone-400 touch-manipulation active:!scale-95 dark:!text-zinc-500" @click="mobileMenu.close()" />
                </div>
              </div>
            </template>
            <div class="px-3 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] min-w-0 max-w-full">
              <div class="flex flex-col gap-0.5">
                <Button unstyled class="ulove-nav group w-full !p-0" @click="mobileMenu.selectTab(s, 'feed')">
                  <span class="flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98]" :class="s.activeTab.value === 'feed' ? 'bg-rose-50 dark:bg-rose-950/40' : 'hover:bg-stone-100 dark:hover:bg-zinc-800'">
                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-base" :class="s.activeTab.value === 'feed' ? 'bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white' : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-300'"><i class="pi pi-images" /></span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold leading-tight" :class="s.activeTab.value === 'feed' ? 'text-rose-600 dark:text-rose-300' : 'text-stone-900 dark:text-white'">Лента</span>
                      <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Листай людей · безлимит</span>
                    </span>
                    <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                  </span>
                </Button>
                <Button unstyled class="ulove-nav group w-full !p-0" @click="mobileMenu.selectTab(s, 'active')">
                  <span class="flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98]" :class="s.activeTab.value === 'active' ? 'bg-rose-50 dark:bg-rose-950/40' : 'hover:bg-stone-100 dark:hover:bg-zinc-800'">
                    <span class="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-base" :class="s.activeTab.value === 'active' ? 'bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white' : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-300'">
                      <i class="pi pi-bolt" />
                      <span v-if="s.activeUsers.value.length" class="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-900">{{ s.activeUsers.value.length }}</span>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold leading-tight" :class="s.activeTab.value === 'active' ? 'text-rose-600 dark:text-rose-300' : 'text-stone-900 dark:text-white'">Активные · онлайн</span>
                      <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Кто сейчас в ULove</span>
                    </span>
                    <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                  </span>
                </Button>
                <Button unstyled class="ulove-nav group w-full !p-0" @click="mobileMenu.selectTab(s, 'favorites')">
                  <span class="flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98]" :class="s.activeTab.value === 'favorites' ? 'bg-rose-50 dark:bg-rose-950/40' : 'hover:bg-stone-100 dark:hover:bg-zinc-800'">
                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-base" :class="s.activeTab.value === 'favorites' ? 'bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white' : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-300'">
                      <i class="pi pi-star-fill" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold leading-tight" :class="s.activeTab.value === 'favorites' ? 'text-rose-600 dark:text-rose-300' : 'text-stone-900 dark:text-white'">Избранное</span>
                      <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Кого ты лайкнул</span>
                    </span>
                    <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                  </span>
                </Button>
                <Button unstyled class="ulove-nav group w-full !p-0" @click="mobileMenu.selectTab(s, 'admirers')">
                  <span class="flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98]" :class="s.activeTab.value === 'admirers' ? 'bg-rose-50 dark:bg-rose-950/40' : 'hover:bg-stone-100 dark:hover:bg-zinc-800'">
                    <span class="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-base" :class="s.activeTab.value === 'admirers' ? 'bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white' : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-300'">
                      <i class="pi pi-heart-fill" />
                      <span v-if="s.admirersTotal.value" class="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#FD267D] px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-900">{{ s.admirersTotal.value }}</span>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold leading-tight" :class="s.activeTab.value === 'admirers' ? 'text-rose-600 dark:text-rose-300' : 'text-stone-900 dark:text-white'">Лайки мне</span>
                      <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Кто в тебя влюбился</span>
                    </span>
                    <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                  </span>
                </Button>
                <Button unstyled class="ulove-nav group w-full !p-0" @click="mobileMenu.selectTab(s, 'questionnaire')">
                  <span class="flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98]" :class="s.activeTab.value === 'questionnaire' ? 'bg-rose-50 dark:bg-rose-950/40' : 'hover:bg-stone-100 dark:hover:bg-zinc-800'">
                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-base" :class="s.activeTab.value === 'questionnaire' ? 'bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white' : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-300'"><i class="pi pi-user-edit" /></span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold leading-tight" :class="s.activeTab.value === 'questionnaire' ? 'text-rose-600 dark:text-rose-300' : 'text-stone-900 dark:text-white'">Моя анкета</span>
                      <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Как тебя видят в ленте</span>
                    </span>
                    <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                  </span>
                </Button>
                <Button unstyled class="ulove-nav group w-full !p-0" @click="mobileMenu.selectTab(s, 'premium')">
                  <span class="flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98]" :class="s.activeTab.value === 'premium' ? 'bg-rose-50 dark:bg-rose-950/40' : 'hover:bg-stone-100 dark:hover:bg-zinc-800'">
                    <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-base text-white"><i class="pi pi-crown" /></span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-bold leading-tight text-stone-900 dark:text-white">ULove PRO</span>
                      <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Инкогнито · радиус · хайды</span>
                    </span>
                    <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                  </span>
                </Button>
              </div>
            </div>
            <div v-if="s.matches.value.length" class="px-3 mt-3">
              <div class="px-1 mb-1.5 text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-zinc-500">Мэтчи · чат открыт</div>
              <div class="flex gap-3 overflow-x-auto px-1 pb-1">
                <button
                  v-for="m in s.matches.value"
                  :key="m.match_id"
                  type="button"
                  class="flex w-16 shrink-0 flex-col items-center gap-1 active:scale-95 transition"
                  @click="mobileMenu.openMatch(s, m)"
                >
                  <span class="block rounded-full bg-gradient-to-br from-[#FD267D] to-[#FF7854] p-[2.5px]">
                    <Avatar :image="m.user.avatar_url ?? undefined" :label="!m.user.avatar_url ? (m.user.name ?? '?').slice(0, 1) : undefined" shape="circle" class="!block !h-14 !w-14 overflow-hidden !border-2 !border-white dark:!border-zinc-900" />
                  </span>
                  <span class="w-full truncate text-center text-[11px] font-semibold text-stone-600 dark:text-zinc-300">{{ m.user.name }}</span>
                </button>
              </div>
            </div>
            <div class="px-3 mt-2 pb-2">
              <Button unstyled class="w-full !p-0" :disabled="!s.canUndo.value" @click="mobileMenu.undoSwipe(s)">
                <span class="group flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98] hover:bg-stone-100 dark:hover:bg-zinc-800" :class="!s.canUndo.value ? 'opacity-40' : ''">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-100 text-base text-[#FFC629] dark:bg-zinc-800"><i class="pi pi-undo" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold leading-tight text-stone-900 dark:text-white">Откат свайпа</span>
                    <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Осталось: {{ s.leftLabel(s.undosLeft.value) }} · Free 1/день · PRO безлимит</span>
                  </span>
                  <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                </span>
              </Button>
              <Button unstyled class="w-full !p-0" @click="mobileMenu.openFilters(s)">
                <span class="group flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98] hover:bg-stone-100 dark:hover:bg-zinc-800">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-100 text-base text-stone-500 dark:bg-zinc-800 dark:text-zinc-300"><i class="pi pi-sliders-h" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold leading-tight text-stone-900 dark:text-white">Фильтры</span>
                    <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Цель · возраст · рядом</span>
                  </span>
                  <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                </span>
              </Button>
              <Button unstyled class="w-full !p-0" @click="mobileMenu.openHelp(s)">
                <span class="group flex items-center gap-3 w-full p-2.5 pr-3 rounded-2xl text-left transition active:scale-[0.98] hover:bg-stone-100 dark:hover:bg-zinc-800">
                  <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-100 text-base text-stone-500 dark:bg-zinc-800 dark:text-zinc-300"><i class="pi pi-question-circle" /></span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold leading-tight text-stone-900 dark:text-white">Как это работает</span>
                    <span class="mt-0.5 block text-[11px] leading-tight text-stone-500 dark:text-zinc-400">Мэтчи · лимиты · 18+</span>
                  </span>
                  <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
                </span>
              </Button>
              <div class="mt-2 flex items-center gap-2 rounded-2xl bg-stone-100 px-3 py-2.5 text-[11px] font-semibold text-stone-500 dark:bg-zinc-800 dark:text-zinc-400"><i class="pi pi-info-circle shrink-0" /><span>{{ s.isQuotaEmpty.value ? 'Лимит исчерпан — мэтчи пишут бесплатно' : 'Без мэтча · ' + s.quotaLabel.value.toLowerCase() + ' · мэтч открывает чат всегда' }}</span></div>
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
            <div class="flex items-center gap-3 opacity-80">
              <ToggleSwitch class="shrink-0" v-model="s.privacy.value.dating_hide_distance" input-id="hide-distance" />
              <label for="hide-distance" class="text-sm text-stone-700 dark:text-zinc-200">Скрыть расстояние · виден только город <span class="text-amber-500 font-bold">PRO</span></label>
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

      <MatchSplash :active="!!s.matchedCard.value" />

      <SwipeDetailsDialog :card="detailsCard" @close="detailsCard = null" />

      <Dialog :visible="s.showHelp.value" @update:visible="(v:boolean)=>{ s.showHelp.value = v }" modal header="Как работают свайпы" :style="{ width: '420px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <div class="flex flex-col gap-3 text-sm text-stone-600 dark:text-zinc-300 pt-1">
          <div>ULove — без географии: листай, свайпай и находи людей со всего приложения, не важно в каком они городе. Главное — что человек в UPin. Логика пинов и карты здесь не действует.</div>
          <div>Фильтр «Люди рядом» — только если хочешь локально. Без него показывают всех. Free: рядом до 10 км, дальше — PRO.</div>
          <div>Свайпы безлимитные. Сообщения без мэтча: Free {{ s.quota.value ? `${s.quota.value.left}/${s.quota.value.limit}` : '3/3' }}, PRO — 10/мес. Взаимный лайк (мэтч) открывает чат всегда, даже при исчерпанном лимите.</div>
          <div>Избранное — свежие лайкнутые без мэтча. Лимиты: Free до 3, Pro до 5, Business до 15. Лайки сверх лимита тоже ждут мэтча — человек их видит.</div>
          <div>Лента умная: выше те, кто лайкнул тебя (особенно суперлайком), кто онлайн, с общими интересами и целью, с фото, рядом и новички.</div>
          <div>Синее сердце — суперлайк: Free 1/день, PRO 5/день, пак +5 докупается. Жёлтая стрелка — откат последнего свайпа: Free 1/день, PRO безлимитно — в боковом меню (бургер сверху).</div>
          <div>Всех просвайпал(а)? Free возвращает ленту один раз кнопкой «Начать заново», а PRO — безлимитно кнопкой «Показать снова».</div>
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
</template>

<style scoped>
.ulove-drawer :deep(.p-drawer-header) {
  padding: 0;
}
.float-heart {
  animation: ulove-float 3.2s ease-in-out infinite;
}
.float-heart-delayed {
  animation: ulove-float 4.1s ease-in-out 0.8s infinite;
}
@keyframes ulove-float {
  0%, 100% { transform: translateY(0) rotate(-8deg); opacity: 0.35; }
  50% { transform: translateY(-6px) rotate(8deg); opacity: 0.6; }
}
.heartbeat {
  animation: ulove-beat 1.6s ease-in-out infinite;
  transform-origin: center;
}
@keyframes ulove-beat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.18); }
  30% { transform: scale(1); }
  45% { transform: scale(1.12); }
}
.pro-shine::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.45) 50%, transparent 60%);
  transform: translateX(-120%);
  animation: ulove-shine 3.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes ulove-shine {
  0%, 60% { transform: translateX(-120%); }
  100% { transform: translateX(120%); }
}
.ulove-nav :deep(.p-button) {
  padding: 0;
  background: transparent;
  border: 0;
}
/* Сайдбар вплотную к правому краю: убиваем десктопный зазор */
.ulove-drawer {
  right: 0 !important;
  margin-right: 0 !important;
  margin-left: auto !important;
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}
.ulove-drawer :deep(.p-drawer-content) {
  padding: 0;
  overflow-x: hidden;
}
@media (max-width: 639px) {
  .ulove-drawer {
    width: 86vw !important;
    max-width: 340px !important;
  }
  .swipes-feed,
  .swipe-deck {
    overscroll-behavior: none;
  }
}
/* Экран ленты на мобиле — как страница без вложенного скролла:
   ровно высота между сейф-зоной сверху и нижним меню, скролла нет,
   верх + карточка + кнопки всегда видны целиком. */
.swipes-feed-lock {
  height: calc(100dvh - var(--sat));
  max-height: calc(100dvh - var(--sat));
  overflow-y: auto;
  overflow-x: clip;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
.swipes-feed-inner {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.swipes-feed {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
/* Обёртка текущей карточки: продолжает flex-цепочку до колоды,
   иначе absolute-содержимое колоды даёт высоту 0 и карточка исчезает. */
.swipes-card-wrap {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.swipe-deck,
.swipes-feed-skeleton {
  flex: 1 1 auto;
}
/* Телефоны (портрет): никакого вложенного скролла — верхняя панель,
   карточка и кнопки ровно на один экран. min-height у колоды —
   страховка от схлопывания: высота лока минус верхняя панель,
   отступы и панель кнопок (~172px). Во flex-раскладке колода всё
   равно растянется на остаток, в блочной — встанет на этот размер. */
@media (max-width: 639.98px) {
  .swipes-feed-lock {
    height: calc(100dvh - var(--app-bottomnav) - var(--sab) - var(--sat));
    max-height: calc(100dvh - var(--app-bottomnav) - var(--sab) - var(--sat));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    overscroll-behavior: none;
  }
  .swipes-feed-inner {
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
  }
  .swipes-feed-lock .swipes-feed {
    flex: 1 1 auto;
    min-height: 0;
    margin-bottom: 0;
  }
  .swipes-feed-lock .swipes-card-wrap {
    flex: 1 1 auto;
    min-height: 0;
  }
  .swipes-feed-lock .swipe-deck,
  .swipes-feed-lock .swipes-feed-skeleton {
    flex: 1 1 auto;
    height: auto;
    min-height: calc(100dvh - var(--app-bottomnav) - var(--sab) - var(--sat) - 172px);
  }
}
/* Планшеты / ландшафт / узкий десктоп: лок остаётся скроллируемым
   (базовые правила выше), колода — фиксированной десктопной высоты
   sm:h-[62dvh], ничего не клиппится. */
@supports not (height: 100dvh) {
  .swipes-feed-lock {
    height: calc(100vh - var(--sat));
    max-height: calc(100vh - var(--sat));
  }
  @media (max-width: 639.98px) {
    .swipes-feed-lock {
      height: calc(100vh - var(--app-bottomnav) - var(--sab) - var(--sat));
      max-height: calc(100vh - var(--app-bottomnav) - var(--sab) - var(--sat));
    }
    .swipes-feed-lock .swipe-deck,
    .swipes-feed-lock .swipes-feed-skeleton {
      min-height: calc(100vh - var(--app-bottomnav) - var(--sab) - var(--sat) - 172px);
    }
  }
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
    transform: translate(var(--from-x, 0px), var(--from-y, 0px)) rotate(-8deg);
    opacity: 1;
  }
  to {
    transform: translate(-110vw, 140px) rotate(-30deg);
    opacity: 0;
  }
}
@keyframes fly-pass {
  from {
    transform: translate(var(--from-x, 0px), var(--from-y, 0px)) rotate(8deg);
    opacity: 1;
  }
  to {
    transform: translate(110vw, 140px) rotate(30deg);
    opacity: 0;
  }
}</style>

