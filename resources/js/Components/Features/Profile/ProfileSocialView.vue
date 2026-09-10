<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import OnlineDot from '@/Components/Features/Feedback/OnlineDot.vue'
import ProfileMoreMenu from '@/Components/Features/Profile/ProfileMoreMenu.vue'
import UserSubscribeButton from '@/Components/Features/Profile/UserSubscribeButton.vue'
import { useGender } from '@/composables/useGender'
import { useSwipesCta } from '@/composables/useSwipesCta'
import { ageLabel, calcAge } from '@/composables/useUserAge'
import { useSwipeTabs } from '@/composables/useSwipeTabs'
import { usePhotoPicker } from '@/composables/usePhotoPicker'

const props = defineProps<{
  user: any
  avatarSrc: string
  online: boolean
  lastSeen: string
  levelName: string
  isOwn: boolean
  isLocked: boolean
  canMessage: boolean
  isBlocked: boolean
  isFriend: boolean
  isPending: boolean
  loading: boolean
  sharing: boolean
  bioEmpty: boolean
  bioText: string
  registeredAt: string
  photos: any[]
  photosCount: number
  friendsCount: number | null
  galleryLimit: number
  galleryCanAdd: boolean
  galleryLoading: boolean
  galleryUploading: boolean
  subscription?: { subscribed: boolean; notify_pin: boolean; notify_photo: boolean; notify_level: boolean }
}>()

const emit = defineEmits<{
  (e: 'avatar'): void
  (e: 'chat'): void
  (e: 'add'): void
  (e: 'remove'): void
  (e: 'block'): void
  (e: 'unblock'): void
  (e: 'share'): void
  (e: 'friends'): void
  (e: 'search'): void
  (e: 'addPhoto', file: File): void
  (e: 'openPhoto', photo: any): void
}>()

const tab = ref<'short' | 'gallery' | 'info'>('short')
const swipe = useSwipeTabs(['short', 'gallery', 'info'] as const, tab)
const { pickerInput, openPicker, handlePickerChange } = usePhotoPicker({
  onPick: (file: File) => emit('addPhoto', file),
})
const g = useGender()
const { goSwipes } = useSwipesCta()

const ageText = computed(() => {
  const direct = props.user?.age != null ? ageLabel(Number(props.user.age)) : ''
  if (direct) return direct
  const c = calcAge(props.user?.birth_date)
  return c != null ? ageLabel(c) : ''
})

const residenceText = computed(() => [props.user?.country, props.user?.home_city].filter(Boolean).join(', '))
const remainingSlots = computed(() => Math.max(0, props.galleryLimit - props.photos.length))
const emptyTiles = computed(() => {
  if (!props.isOwn || !props.galleryCanAdd || props.isLocked) return 0
  return Math.min(remainingSlots.value, 3)
})
const extraSlots = computed(() => {
  if (!props.isOwn || !props.galleryCanAdd || props.isLocked) return 0
  return Math.max(0, remainingSlots.value - emptyTiles.value)
})
const friendLabel = computed(() => (props.isFriend ? 'В друзьях' : props.isPending ? 'Ожидает' : 'В друзья'))
const statCls = 'flex-1 min-w-0 flex flex-col items-center sm:block sm:text-left px-2 py-2 sm:py-1 rounded-xl transition active:scale-[0.98] hover:bg-stone-100 dark:hover:bg-white/5'
</script>

<template>
  <div v-if="isLocked" class="bg-white dark:bg-zinc-900 border border-stone-200/70 dark:border-zinc-800 rounded-3xl p-6 flex flex-col items-center text-center gap-3 mx-3 sm:mx-0">
    <button @click="emit('avatar')" class="w-16 h-16 rounded-3xl overflow-hidden bg-stone-100 dark:bg-zinc-800"><Avatar :image="avatarSrc" shape="square" class="!w-full !h-full [&_img]:object-cover" /></button>
    <Message severity="error" :closable="false" class="max-w-[420px] !rounded-2xl"><span class="font-bold">⛔ Пользователь заблокировал вас</span></Message>
    <p class="text-stone-500 dark:text-zinc-400 text-sm">Профиль скрыт.</p>
    <Link href="/map"><Button label="На карту →" rounded class="!bg-gradient-to-r !from-violet-600 !to-indigo-600 !border-0 !text-white !text-sm !font-bold !shadow-glow" /></Link>
  </div>

  <div v-else class="bg-white dark:bg-zinc-900 sm:border sm:border-stone-200/70 sm:dark:border-zinc-800 sm:rounded-3xl">
    <div class="px-4 sm:px-6 pt-0.5 sm:pt-1">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <button @click="emit('avatar')" class="relative shrink-0 self-start rounded-[26px] p-1 bg-white dark:bg-zinc-900 shadow-soft" aria-label="Открыть фото">
          <span class="block w-24 h-24 sm:w-36 sm:h-36 rounded-[20px] overflow-hidden bg-stone-100 dark:bg-zinc-800">
            <Avatar :image="avatarSrc" shape="square" class="!w-full !h-full !rounded-[20px] [&_img]:!rounded-[20px] [&_img]:object-cover" />
          </span>
          <OnlineDot :online="online" size="w-5 h-5 sm:w-6 sm:h-6" class="absolute bottom-1.5 right-1.5 ring-[3px] ring-white dark:ring-zinc-900" />
        </button>
        <div class="min-w-0 flex-1 sm:pb-1">
          <div class="flex items-center gap-2 min-w-0 flex-wrap">
            <h1 class="text-xl sm:text-[26px] font-black tracking-tight truncate text-ink-900 dark:text-white">{{ user.name }}</h1>
            <Tag :value="levelName" rounded class="!text-[10px] sm:!text-[11px] !font-bold !bg-blue-600 !text-white !border-0 shrink-0" />
          </div>
          <p class="text-[13px] sm:text-sm mt-1 truncate" :class="online ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-stone-500 dark:text-zinc-400'">
            {{ online ? 'в сети' : lastSeen }}
          </p>
          <p v-if="residenceText" class="text-xs sm:text-[13px] mt-0.5 truncate text-stone-500 dark:text-zinc-400">{{ residenceText }}</p>
        </div>
        <div class="flex gap-2 shrink-0 sm:pb-2 w-full sm:w-auto">
          <template v-if="isOwn">
            <Link :href="route('profile.edit')" class="flex-1 sm:flex-none min-w-0"><Button label="Редактировать" icon="pi pi-pencil" class="w-full sm:w-auto !rounded-xl !text-[13px] !font-bold !bg-blue-600 hover:!bg-blue-500 !border-0 !text-white [&_.p-button-label]:truncate" /></Link>
            <Button icon="pi pi-users" aria-label="Друзья" title="Друзья" class="!rounded-xl !w-11 shrink-0 !bg-blue-600/10 dark:!bg-blue-500/15 !border-0 !text-blue-600 dark:!text-blue-400" @click="emit('friends')" />
            <Button icon="pi pi-share-alt" aria-label="Поделиться" title="Поделиться" :loading="sharing" class="!rounded-xl !w-11 shrink-0 !bg-violet-600/10 dark:!bg-violet-500/15 !border-0 !text-violet-600 dark:!text-violet-300" @click="emit('share')" />
            <Button icon="pi pi-search" aria-label="Поиск людей" title="Поиск людей" class="!rounded-xl !w-11 shrink-0 !bg-emerald-600/10 dark:!bg-emerald-500/15 !border-0 !text-emerald-600 dark:!text-emerald-400" @click="emit('search')" />
          </template>
          <template v-else>
            <Button v-if="canMessage && !isBlocked" icon="pi pi-comments" :loading="loading" aria-label="Написать сообщение" title="Написать сообщение" class="!rounded-xl !w-11 shrink-0 !bg-blue-600 hover:!bg-blue-500 !border-0 !text-white" @click="emit('chat')" />
            <Button v-if="!isBlocked" :label="friendLabel" :icon="isFriend ? 'pi pi-check' : 'pi pi-user-plus'" :loading="loading" class="flex-1 min-w-0 !rounded-xl !text-[13px] !font-bold !border-0 [&_.p-button-label]:truncate" :class="isFriend ? '!bg-emerald-50 dark:!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400' : '!bg-stone-100 dark:!bg-white/10 !text-ink-900 dark:!text-white'" @click="isFriend ? emit('remove') : emit('add')" />
            <UserSubscribeButton v-if="!isBlocked && isFriend" :user-id="(user as any).id" :initial="subscription" :compact="true" :is-friend="isFriend" />
            <ProfileMoreMenu v-if="!isBlocked" :user-id="(user as any).id" :user-name="(user as any).name" @share="emit('share')" @block="emit('block')" @remove="emit('remove')" />
            <Button v-else label="Разблокировать" icon="pi pi-ban" :loading="loading" severity="danger" outlined class="flex-1 min-w-0 !rounded-xl !text-[13px] !font-bold [&_.p-button-label]:truncate" @click="emit('unblock')" />
          </template>
        </div>
      </div>

      <div class="mt-3 sm:mt-4 flex items-stretch border-y border-stone-200/70 dark:border-zinc-800">
        <button type="button" :class="statCls" @click="emit('friends')">
          <span class="text-[15px] sm:text-lg font-black text-ink-900 dark:text-white">{{ friendsCount ?? '–' }}</span>
          <span class="block text-[11px] sm:text-xs text-stone-500 dark:text-zinc-400">друзей</span>
        </button>
        <div class="w-px bg-stone-200/70 dark:bg-zinc-800 my-2"></div>
        <button type="button" :class="statCls" @click="tab = 'gallery'">
          <span class="text-[15px] sm:text-lg font-black text-ink-900 dark:text-white">{{ photosCount }}</span>
          <span class="block text-[11px] sm:text-xs text-stone-500 dark:text-zinc-400">фотографий</span>
        </button>
        <div class="w-px bg-stone-200/70 dark:bg-zinc-800 my-2"></div>
        <div :class="statCls">
          <span class="text-[15px] sm:text-lg font-black text-ink-900 dark:text-white">{{ user.reputation_score || 0 }}</span>
          <span class="block text-[11px] sm:text-xs text-stone-500 dark:text-zinc-400">репутация</span>
        </div>
      </div>

      <div class="flex gap-1 sm:gap-2 border-b border-stone-200/70 dark:border-zinc-800 sticky top-16 z-[5] bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
        <button type="button" @click="tab = 'short'" :class="['px-3 sm:px-4 py-3 text-[13px] sm:text-sm font-bold border-b-[3px] -mb-px transition', tab === 'short' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-zinc-200']">О себе</button>
        <button type="button" @click="tab = 'gallery'" :class="['px-3 sm:px-4 py-3 text-[13px] sm:text-sm font-bold border-b-[3px] -mb-px transition', tab === 'gallery' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-zinc-200']">Галерея</button>
        <button type="button" @click="tab = 'info'" :class="['px-3 sm:px-4 py-3 text-[13px] sm:text-sm font-bold border-b-[3px] -mb-px transition', tab === 'info' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-zinc-200']">Информация</button>
      </div>
    </div>

    <div v-if="tab === 'short'" class="p-4 sm:p-6 text-sm lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5 lg:items-start" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd">
      <div class="rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/70 dark:border-zinc-800 divide-y divide-stone-200 dark:divide-zinc-800 overflow-hidden">
        <div class="flex justify-between gap-3 px-4 py-3"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-user"></i>Имя</span><span class="font-semibold text-ink-900 dark:text-white text-right truncate">{{ user.name }}</span></div>
        <div v-if="user.country" class="flex justify-between gap-3 px-4 py-3"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-flag"></i>Страна</span><span class="font-semibold text-ink-900 dark:text-white text-right">{{ user.country }}</span></div>
        <div v-if="user.home_city" class="flex justify-between gap-3 px-4 py-3"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-map-marker"></i>Город</span><span class="font-semibold text-ink-900 dark:text-white text-right">{{ user.home_city }}</span></div>
        <div v-if="ageText" class="flex justify-between gap-3 px-4 py-3"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-cake"></i>Возраст</span><span class="font-semibold text-ink-900 dark:text-white">{{ ageText }}</span></div>
        <div v-if="user.gender" class="flex justify-between gap-3 px-4 py-3"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-users"></i>Пол</span><span class="font-semibold text-ink-900 dark:text-white">{{ g.getLabel(user.gender) }}</span></div>
      </div>
      <button type="button" @click="goSwipes()" class="relative mt-3 lg:mt-0 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white text-left p-5 transition hover:opacity-95 active:scale-[0.99]">
        <div class="absolute inset-0 opacity-[0.12]" style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 18px 18px"></div>
        <div class="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl"></div>
        <span class="relative block w-16 h-16 rounded-2xl bg-white/15 border border-white/25 grid place-items-center"><i class="pi pi-heart text-3xl"></i></span>
        <span class="relative block mt-4 text-lg font-black leading-tight">Начать<br />знакомиться</span>
        <span class="relative block mt-1 text-xs text-white/70 leading-snug">Люди рядом на живой карте — напиши первым</span>
        <span class="relative mt-4 inline-flex items-center gap-2 bg-white text-ink-900 text-[13px] font-bold rounded-full px-4 py-2">Найти людей<i class="pi pi-arrow-right text-xs"></i></span>
      </button>
    </div>

    <div v-else-if="tab === 'gallery'" class="p-3 sm:p-5" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd">
      <div class="min-w-0">
        <p v-if="!bioEmpty" class="lg:hidden text-[13px] leading-relaxed whitespace-pre-wrap break-words text-ink-900 dark:text-zinc-100 mb-3">{{ bioText }}</p>
        <div v-if="galleryLoading && !photos.length" class="rounded-xl overflow-hidden lg:max-w-[760px]">
          <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-[3px]">
            <div v-for="n in 6" :key="`sk-${n}`" class="aspect-square bg-stone-100 dark:bg-zinc-800 animate-pulse"></div>
          </div>
          <div class="mt-2 text-[11px] text-stone-500 dark:text-zinc-400">Загружаем фотографии…</div>
        </div>
        <div v-else-if="photos.length" class="rounded-xl overflow-hidden lg:max-w-[760px]">
          <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-[3px]">
            <div v-if="galleryUploading" class="aspect-square grid place-items-center bg-blue-600/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <span class="flex flex-col items-center gap-1.5"><i class="pi pi-spin pi-spinner text-xl"></i><span class="text-[10px] font-bold">Загрузка…</span></span>
            </div>
            <button v-for="p in photos" :key="p.id" type="button" @click="emit('openPhoto', p)" class="relative aspect-square overflow-hidden bg-stone-100 dark:bg-zinc-800 group">
              <img :src="p.url" :alt="p.caption || 'фото'" loading="lazy" decoding="async" class="w-full h-full object-cover transition duration-200 group-hover:scale-[1.04]" />
              <span class="absolute inset-0 bg-black/0 group-hover:bg-black/40 group-active:bg-black/40 transition flex items-center justify-center gap-3 text-white text-xs font-bold opacity-0 group-hover:opacity-100 group-active:opacity-100">
                <span>❤️ {{ p.likes_count || 0 }}</span><span>💬 {{ p.comments_count || 0 }}</span>
              </span>
              <span v-if="(p.likes_count || 0) + (p.comments_count || 0) > 0" class="sm:hidden absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/55 rounded-full px-1.5 py-0.5">❤️{{ p.likes_count || 0 }} · 💬{{ p.comments_count || 0 }}</span>
            </button>
            <button v-for="n in emptyTiles" :key="`slot-${n}`" type="button" @click="openPicker" title="Добавить фото" aria-label="Добавить фото" class="aspect-square grid place-items-center border-2 border-dashed border-stone-300 dark:border-zinc-700 text-stone-400 dark:text-zinc-500 hover:border-blue-500 hover:text-blue-500 dark:hover:border-blue-400 dark:hover:text-blue-400 hover:bg-blue-500/5 transition active:scale-[0.97]">
              <span class="flex flex-col items-center gap-1"><i class="pi pi-plus text-xl"></i><span class="text-[10px] font-bold">Добавить</span></span>
            </button>
          </div>
          <div v-if="isOwn" class="mt-2 text-[11px] text-stone-500 dark:text-zinc-400">Занято {{ photosCount }} из {{ galleryLimit }} · {{ extraSlots > 0 ? `ещё ${extraSlots} свободно` : galleryCanAdd ? 'можно добавить' : 'лимит тарифа — Pro даёт больше' }}</div>
        </div>
        <div v-else class="py-10 px-6 text-center border border-dashed border-stone-200 dark:border-zinc-700 rounded-2xl">
          <div class="w-14 h-14 mx-auto rounded-full bg-blue-600/10 grid place-items-center"><i class="pi pi-camera text-xl text-blue-600 dark:text-blue-400"></i></div>
          <div class="mt-3 font-black text-ink-900 dark:text-white">Пока нет фотографий</div>
          <p class="text-xs text-stone-500 dark:text-zinc-400 mt-1">{{ isOwn ? 'Поделись первым моментом района' : 'Пользователь ещё ничего не опубликовал' }}</p>
          <Button v-if="isOwn" label="Добавить фото" icon="pi pi-plus" rounded class="mt-4 !bg-blue-600 hover:!bg-blue-500 !border-0 !text-white !text-sm !font-bold" @click="openPicker" />
        </div>
      </div>
      <input ref="pickerInput" type="file" accept="image/*" class="absolute w-px h-px opacity-0 overflow-hidden pointer-events-none" tabindex="-1" aria-hidden="true" @change="handlePickerChange" />
    </div>

    <div v-else class="p-4 sm:p-6 text-sm" @touchstart.passive="swipe.onTouchStart" @touchend.passive="swipe.onTouchEnd">
      <div v-if="!bioEmpty" class="rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/70 dark:border-zinc-800 p-4">
        <div class="text-[11px] font-bold tracking-widest uppercase text-stone-400 dark:text-zinc-500">О себе</div>
        <p class="mt-2 leading-relaxed whitespace-pre-wrap break-words text-ink-900 dark:text-zinc-100">{{ bioText }}</p>
      </div>
      <div class="mt-2">
        <div class="flex justify-between gap-3 py-3 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-user"></i>Имя</span><span class="font-semibold text-ink-900 dark:text-white text-right truncate">{{ user.name }}</span></div>
        <div v-if="user.gender" class="flex justify-between gap-3 py-3 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Пол</span><span class="font-semibold text-ink-900 dark:text-white">{{ g.getLabel(user.gender) }}</span></div>
        <div v-if="ageText" class="flex justify-between gap-3 py-3 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Возраст</span><span class="font-semibold text-ink-900 dark:text-white">{{ ageText }}</span></div>
        <div v-if="user.country" class="flex justify-between gap-3 py-3 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-flag"></i>Страна</span><span class="font-semibold text-ink-900 dark:text-white text-right">{{ user.country }}</span></div>
        <div class="flex justify-between gap-3 py-3 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400 flex items-center gap-2"><i class="pi pi-map-marker"></i>Город</span><span class="font-semibold text-ink-900 dark:text-white text-right">{{ user.home_city || 'Не указан' }}</span></div>
        <div class="flex justify-between gap-3 py-3 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Уровень</span><span class="font-semibold text-ink-900 dark:text-white">{{ levelName }}</span></div>
        <div class="flex justify-between gap-3 py-3 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500 dark:text-zinc-400">Репутация</span><span class="font-semibold text-ink-900 dark:text-white">{{ user.reputation_score || 0 }} ★</span></div>
        <div class="flex justify-between gap-3 py-3"><span class="text-stone-500 dark:text-zinc-400">На карте с</span><span class="font-semibold text-ink-900 dark:text-white">{{ registeredAt }}</span></div>
      </div>
      <div class="pt-2 pb-1">
        <Link href="/map" class="flex flex-1"><Button label="На карту →" rounded class="w-full !bg-ink-900 dark:!bg-white dark:!text-ink-900 !text-white" /></Link>
      </div>
    </div>
  </div>
</template>
