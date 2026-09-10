<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3'
import { computed, onMounted } from 'vue'
import GuestLayout from '@/Layouts/GuestLayout.vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { useSwipes } from '@/composables/useSwipes'
import { useSwipeCardPhotos } from '@/composables/useSwipeCardPhotos'
import { useSwipePhotoViewer } from '@/composables/useSwipePhotoViewer'
import { useSeo } from '@/composables/useSeo'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
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
const viewer = useSwipePhotoViewer()
const cardPhotos = useSwipeCardPhotos(() => s.current.value)

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
  { label: 'Рядом: любой', value: null },
  { label: '5 км', value: 5 },
  { label: '15 км', value: 15 },
  { label: '50 км', value: 50 },
]

onMounted(async () => {
  if (isAuth.value) {
    await s.loadFeed()
    await s.loadMatches()
    await s.loadFavorites()
  }
})
</script>

<template>
  <Head :title="seo.title.value">
    <meta head-key="description" name="description" :content="seo.description.value" />
  </Head>
  <component :is="Layout">
    <div class="min-h-[calc(100vh-64px)] bg-surface dark:bg-[#090E1A]">
      <div class="max-w-[520px] mx-auto px-4 sm:px-6 py-5 sm:py-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">

        <div class="text-center">
          <div class="flex items-center justify-center gap-2.5">
            <span class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400 grid place-items-center text-white shadow-lg shadow-rose-500/30 dark:shadow-rose-500/20"><i class="pi pi-heart-fill text-lg sm:text-xl" /></span>
            <h1 class="text-[32px] sm:text-[42px] font-black tracking-[-0.04em] leading-none bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 dark:from-rose-400 dark:via-fuchsia-400 dark:to-orange-300 bg-clip-text text-transparent">ULove</h1>
          </div>
          <p class="mt-2 text-[13px] sm:text-sm text-stone-500 dark:text-zinc-400">Дейтинг внутри UPin🔥</p>
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
          <div class="mt-4 flex items-center gap-2">
            <Chip :label="s.quotaLabel.value" icon="pi pi-send" class="!rounded-full" />
            <Chip v-if="s.isQuotaEmpty.value" label="Лимит исчерпан — мэтчи пишут бесплатно" icon="pi pi-heart-fill" class="!rounded-full !bg-rose-100 !text-rose-700 dark:!bg-rose-950 dark:!text-rose-300 dark:!border dark:!border-rose-900" />
            <span class="flex-1" />
            <Button icon="pi pi-sliders-h" severity="secondary" rounded outlined size="small" aria-label="Фильтры" @click="s.showFilters.value = true" />
            <Button icon="pi pi-refresh" severity="secondary" rounded outlined size="small" aria-label="Обновить ленту" :loading="s.loading.value" @click="s.loadFeed()" />
            <Button v-if="s.isAdmin.value" icon="pi pi-trash" severity="warn" rounded outlined size="small" aria-label="Сбросить просмотренные" title="Сбросить просмотренные (админ)" :loading="s.resetting.value" @click="s.resetHistory()" />
          </div>

          <div v-if="s.matches.value.length" class="mt-4">
            <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500 mb-2">Мэтчи · чат открыт</div>
            <div class="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                v-for="m in s.matches.value"
                :key="m.match_id"
                class="shrink-0 flex flex-col items-center gap-1 w-[64px] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                @click="s.openChat(m.user.id, m.conversation_id)"
              >
                <span class="relative">
                  <Avatar :image="m.user.avatar_url ?? undefined" :label="!m.user.avatar_url ? (m.user.name ?? '?').slice(0, 1) : undefined" shape="circle" size="large" class="!w-14 !h-14 ring-2 ring-emerald-400 dark:ring-emerald-500" />
                  <span class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 grid place-items-center"><i class="pi pi-heart-fill text-white text-[10px]" /></span>
                </span>
                <span class="text-[11px] font-semibold text-stone-600 dark:text-zinc-200 truncate w-full text-center">{{ m.user.name }}</span>
              </button>
            </div>
          </div>

          <div v-if="s.error.value" class="mt-3 text-sm text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl px-4 py-3">
            {{ s.error.value }}
          </div>

          <div class="mt-3 grid grid-cols-2 gap-1 p-1 rounded-2xl bg-stone-100 dark:bg-zinc-800">
            <button type="button" @click="s.activeTab.value = 'feed'" :class="['py-2 rounded-xl text-[13px] font-bold transition', s.activeTab.value === 'feed' ? 'bg-white dark:bg-zinc-900 text-ink-900 dark:text-white shadow-soft' : 'text-stone-500 dark:text-zinc-400']">Лента</button>
            <button type="button" @click="s.activeTab.value = 'favorites'" :class="['py-2 rounded-xl text-[13px] font-bold transition', s.activeTab.value === 'favorites' ? 'bg-white dark:bg-zinc-900 text-ink-900 dark:text-white shadow-soft' : 'text-stone-500 dark:text-zinc-400']">Избранное · {{ s.favoritesCount.value }}/{{ s.favoritesLimit.value }}</button>
          </div>

          <template v-if="s.activeTab.value === 'favorites'">
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
              <div class="mt-4"><Button label="К ленте" rounded size="small" @click="s.activeTab.value = 'feed'" /></div>
            </div>
          </template>

          <template v-else>
          <div class="mt-4 relative select-none">
            <div v-if="s.loading.value" class="rounded-[24px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-[62dvh] min-h-[400px] max-h-[540px] grid place-items-center">
              <i class="pi pi-spin pi-spinner text-2xl text-stone-400 dark:text-zinc-500" />
            </div>

            <div v-else-if="s.current.value" class="swipe-deck relative h-[62dvh] min-h-[400px] max-h-[540px]">
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
                <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                <div v-if="cardPhotos.hasMultiple.value" class="absolute top-2.5 inset-x-3 flex gap-1">
                  <button
                    v-for="(p, i) in cardPhotos.photos.value"
                    :key="`${s.current.value.id}-${i}`"
                    type="button"
                    :class="['h-[5px] flex-1 rounded-full transition cursor-pointer', i === cardPhotos.photoIndex.value ? 'bg-white' : 'bg-white/40 hover:bg-white/70']"
                    :aria-label="`Фото ${i + 1} из ${cardPhotos.total.value}`"
                    @pointerdown.stop
                    @click.stop="cardPhotos.goTo(i)"
                  />
                </div>

                <div
                  class="absolute top-5 left-5 rotate-[-12deg] border-4 border-emerald-400 text-emerald-300 font-black text-2xl px-3 py-1 rounded-xl bg-black/20"
                  :style="{ opacity: s.likeStrength.value, transform: `scale(${0.8 + s.likeStrength.value * 0.3})` }"
                >ЛАЙК</div>
                <div
                  class="absolute top-5 right-5 rotate-[12deg] border-4 border-rose-500 text-rose-400 font-black text-2xl px-3 py-1 rounded-xl bg-black/20"
                  :style="{ opacity: s.passStrength.value, transform: `scale(${0.8 + s.passStrength.value * 0.3})` }"
                >ПАС</div>

                <div v-if="s.current.value.liked_me" class="absolute top-4 right-4 pointer-events-none">
                  <Chip label="Лайкнул тебя" icon="pi pi-heart-fill" class="!rounded-full !bg-rose-500 !text-white !border-0" />
                </div>

                <div v-if="s.current.value.photos.length" class="absolute top-11 left-3" @pointerdown.stop @pointermove.stop @pointerup.stop>
                  <Button
                    :label="`${s.current.value.photos.slice(0, s.current.value.is_pro ? 5 : 3).length}`"
                    icon="pi pi-images"
                    rounded
                    size="small"
                    aria-label="Смотреть фото"
                    title="Смотреть фото"
                    class="!bg-black/55 !border-white/20 !text-white backdrop-blur"
                    @click.stop="s.current.value && viewer.open(s.current.value)"
                  />
                </div>

                <div class="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white pointer-events-none">
                  <div class="flex items-baseline gap-2">
                    <span class="text-[24px] sm:text-[26px] font-black leading-none">{{ s.current.value.name }}</span>
                    <span class="text-lg sm:text-xl font-bold opacity-90">{{ s.ageLabel(s.current.value) }}</span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <Chip :label="s.goalLabel(s.current.value.goal)" class="!rounded-full !bg-white/15 !text-white !border-0 text-xs" />
                    <Chip v-if="s.current.value.city" :label="s.current.value.city" icon="pi pi-map-marker" class="!rounded-full !bg-white/15 !text-white !border-0 text-xs" />
                    <Chip v-if="s.current.value.distance_km != null" :label="`${s.current.value.distance_km} км`" icon="pi pi-send" class="!rounded-full !bg-white/15 !text-white !border-0 text-xs" />
                  </div>
                  <div v-if="s.current.value.interests.length" class="mt-2 flex flex-wrap gap-1.5">
                    <Chip v-for="t in s.current.value.interests" :key="t" :label="`#${t}`" class="!rounded-full !bg-white/10 !text-white/90 !border !border-white/20 text-xs" />
                  </div>
                  <p v-if="s.current.value.bio" class="mt-2 text-sm text-white/85 line-clamp-2">{{ s.current.value.bio }}</p>
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
            </div>

            <div v-else class="rounded-[24px] border border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center">
              <div class="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white grid place-items-center"><i class="pi pi-heart-fill text-xl" /></div>
              <template v-if="s.feedExhausted.value && !s.hasActiveFilters.value">
                <div class="mt-4 text-lg font-black text-stone-900 dark:text-white">Ты просвайпал(а) всех рядом 🎉</div>
                <div class="text-sm text-stone-500 dark:text-zinc-400 mt-1">Лайкнутые сохранены в «Избранном». Новые люди появляются каждый день — загляни позже.</div>
                <div class="mt-4 flex gap-2 justify-center flex-wrap">
                  <Button label="Моё избранное" rounded size="small" class="!bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0 !text-white" @click="s.activeTab.value = 'favorites'" />
                  <Button label="Обновить" severity="secondary" rounded outlined size="small" @click="s.loadFeed()" />
                  <Button v-if="s.isAdmin.value" label="Сбросить просмотренные" icon="pi pi-trash" severity="warn" rounded outlined size="small" :loading="s.resetting.value" @click="s.resetHistory()" />
                </div>
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

          <div v-if="s.current.value" class="mt-4 flex items-center justify-center gap-2.5 sm:gap-4 pb-[env(safe-area-inset-bottom,0px)]">
            <Button icon="pi pi-times" severity="danger" rounded raised aria-label="Пропустить" class="!w-14 !h-14 sm:!w-16 sm:!h-16 !text-xl sm:!text-2xl" :loading="s.acting.value" @click="s.swipe('pass')" />
            <Button icon="pi pi-heart-fill" rounded raised aria-label="Лайк" class="!w-[72px] !h-[72px] sm:!w-20 sm:!h-20 !text-2xl sm:!text-3xl !text-white !bg-gradient-to-br !from-rose-500 !to-orange-400 !border-0" :loading="s.acting.value" @click="s.swipe('like')" />
            <Button icon="pi pi-send" severity="info" rounded raised aria-label="Написать" class="!w-14 !h-14 sm:!w-16 sm:!h-16 !text-xl sm:!text-2xl" :loading="s.creatingChat.value" @click="s.writeWithoutMatch(s.current.value.id)" />
          </div>
          <div class="mt-2 text-center text-xs text-stone-400 dark:text-zinc-500">Свайпы безлимитные · сообщения: free {{ s.quota.value ? `${s.quota.value.left}/${s.quota.value.limit}` : '3/3' }} · мэтч открывает чат всегда · 18+</div>

          <Link href="/map" class="mt-5 flex items-center gap-3 rounded-[20px] border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-soft">
            <span class="w-11 h-11 rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-300 grid place-items-center shrink-0"><i class="pi pi-map text-lg" /></span>
            <span class="min-w-0">
              <span class="block text-sm font-black text-stone-900 dark:text-white">Карта рядом усиливает знакомства</span>
              <span class="block text-xs text-stone-500 dark:text-zinc-400">Смотри, кто гуляет поблизости, и ставь пины-встречи.</span>
            </span>
            <i class="pi pi-chevron-right ml-auto text-stone-300 dark:text-zinc-600 shrink-0" />
          </Link>
          </template>
        </template>
      </div>

      <Dialog :visible="s.showFilters.value" @update:visible="(v:boolean)=>{ s.showFilters.value = v }" modal header="Фильтры и приватность" :style="{ width: '440px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <div class="flex flex-col gap-4 pt-1 min-w-0">
          <div class="min-w-0">
            <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Что ищешь</label>
            <Select v-model="s.filters.value.goal" :options="goalOptions" option-label="label" option-value="value" placeholder="Любая цель" class="w-full mt-1 dark:!border-zinc-700" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="min-w-0">
              <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Кого показать</label>
              <Select v-model="s.filters.value.gender" :options="genderOptions" option-label="label" option-value="value" class="w-full mt-1 dark:!border-zinc-700" />
            </div>
            <div class="min-w-0">
              <label class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Радиус</label>
              <Select v-model="s.filters.value.radius_km" :options="radiusOptions" option-label="label" option-value="value" placeholder="Любой" class="w-full mt-1 dark:!border-zinc-700" />
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
              <ToggleSwitch v-model="s.privacy.value.dating_match_only" input-id="match-only" />
              <label for="match-only" class="text-sm text-stone-700 dark:text-zinc-200">Писать могут только мэтчи <span class="text-stone-400 dark:text-zinc-500">(базовая приватность, бесплатно)</span></label>
            </div>
            <div class="flex items-center gap-3 opacity-80">
              <ToggleSwitch v-model="s.privacy.value.dating_hide_name" input-id="hide-name" />
              <label for="hide-name" class="text-sm text-stone-700 dark:text-zinc-200">Скрыть имя <span class="text-amber-500 font-bold">PRO</span></label>
            </div>
            <div class="flex items-center gap-3 opacity-80">
              <ToggleSwitch v-model="s.privacy.value.dating_hide_age" input-id="hide-age" />
              <label for="hide-age" class="text-sm text-stone-700 dark:text-zinc-200">Скрыть возраст <span class="text-amber-500 font-bold">PRO</span></label>
            </div>
            <Button label="Сохранить приватность" severity="secondary" size="small" rounded outlined @click="s.savePrivacy()" />
          </div>
          <div class="flex gap-2 pb-[env(safe-area-inset-bottom,0px)]">
            <Button label="Сбросить" severity="secondary" outlined rounded class="flex-1" @click="s.resetFilters()" />
            <Button label="Показать" rounded class="flex-1" @click="s.applyFilters()" />
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

      <Dialog :visible="viewer.viewerOpen.value" @update:visible="(v:boolean)=>{ if(!v) viewer.close() }" modal :draggable="false" :style="{ width: '420px', maxWidth: '94vw', maxHeight: '92dvh' }" :pt="dialogPt">
        <template #header>
          <span class="font-bold">{{ viewer.card.value?.name }} · {{ viewer.counterLabel.value }}</span>
        </template>
        <div v-if="viewer.hasPhotos.value" class="select-none">
          <div class="flex gap-1">
            <button
              v-for="(p, i) in viewer.photos.value"
              :key="i"
              type="button"
              :class="['h-1 flex-1 rounded-full transition', i === viewer.photoIndex.value ? 'bg-rose-500' : i < viewer.photoIndex.value ? 'bg-rose-300' : 'bg-stone-200 dark:bg-zinc-700']"
              :aria-label="`Фото ${i + 1}`"
              @click="viewer.goTo(i)"
            />
          </div>
          <div class="relative mt-2 rounded-2xl overflow-hidden bg-black">
            <img :src="viewer.currentPhoto.value ?? ''" alt="" class="w-full h-[52dvh] min-h-[320px] object-contain bg-black" draggable="false" />
            <button type="button" aria-label="Назад" class="absolute left-0 top-0 h-full w-[28%] cursor-w-pointer" @click="viewer.prev()" />
            <button type="button" aria-label="Вперёд" class="absolute right-0 top-0 h-full w-[28%] cursor-e-pointer" @click="viewer.next()" />
            <Button icon="pi pi-times" rounded text size="small" aria-label="Закрыть" class="!absolute top-2 right-2 !bg-black/50 !text-white !border-0 !w-9 !h-9" @click="viewer.close()" />
            <span class="absolute bottom-2 right-2 text-[11px] font-bold text-white bg-black/55 rounded-full px-2 py-0.5">{{ viewer.counterLabel.value }}</span>
          </div>
          <div class="mt-2 flex items-center justify-between gap-2">
            <Button icon="pi pi-chevron-left" rounded outlined size="small" aria-label="Предыдущее фото" :disabled="viewer.photoIndex.value === 0" @click="viewer.prev()" />
            <span class="text-[11px] text-stone-400 dark:text-zinc-500">Тап по краям фото листает · max {{ viewer.card.value?.is_pro ? 5 : 3 }}</span>
            <Button icon="pi pi-chevron-right" rounded outlined size="small" aria-label="Следующее фото" :disabled="viewer.photoIndex.value >= viewer.total.value - 1" @click="viewer.next()" />
          </div>
        </div>
        <div v-else class="py-6 text-center text-sm text-stone-500 dark:text-zinc-400">Фото пока нет</div>
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
