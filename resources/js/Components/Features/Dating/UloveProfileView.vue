<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import Message from 'primevue/message'
import AppImage from '@/Components/Ui/Media/AppImage.vue'
import { useToast } from 'primevue/usetoast'
import { useUloveProfile } from '@/composables/useUloveProfile'
import { useUloveOnlineBadge } from '@/composables/useUloveOnlineBadge'
import { useSwipeCardPhotos } from '@/composables/useSwipeCardPhotos'

const props = withDefaults(
  defineProps<{
    profileUser: any
    photos: string[]
    avatar?: string | null
    isOwn: boolean
    online?: boolean
    lastSeenText?: string | null
    canMessage?: boolean
    canMessageReason?: string | null
    gallery?: any
  }>(),
  { avatar: null, online: false, lastSeenText: null, canMessage: false, canMessageReason: null, gallery: null },
)

const emit = defineEmits<{ (e: 'edit'): void; (e: 'message'): void; (e: 'photos'): void; (e: 'add-photos'): void }>()

const p = useUloveProfile(() => props.profileUser)

const onlineBadge = useUloveOnlineBadge(() => ({ isOwn: props.isOwn, online: props.online, lastSeenText: props.lastSeenText }))

const toast = (() => {
  try {
    return useToast()
  } catch {
    return null as any
  }
})()

const deletingIds = ref<Set<number>>(new Set())
const armDeleteId = ref<number | null>(null)
let armTimer: ReturnType<typeof setTimeout> | null = null

export interface UlovePhotoSlot {
  key: string
  url: string | null
  photoId: number | null
  isMain?: boolean
}

/** Лимит фото ULove-профиля: не больше 5 (там же hero и счётчик). */
const ULOVE_PHOTOS_LIMIT = 5

/**
 * Фото галереи списком. Важно: пропсы shallow-reactive, поэтому ref'ы
 * внутри объекта галереи (`useProfileGallery`) сами НЕ разворачиваются —
 * прямой `props.gallery.photos.slice` падал с
 * `slice is not a function`. Разворачиваем вручную с фолбэком
 * на обычный массив.
 */
const galleryPhotos = computed(() => {
  const raw = (props.gallery as any)?.photos
  const list = Array.isArray(raw) ? raw : (raw?.value ?? [])
  return (Array.isArray(list) ? list : []) as Array<{ id?: number; url?: string; is_main?: boolean }>
})

/**
 * Флаг загрузки галереи (тот же нюанс с неразвёрнутым ref'ом).
 */
const galleryUploading = computed(() => {
  const raw = (props.gallery as any)?.uploading
  return typeof raw === 'boolean' ? raw : !!raw?.value
})

/**
 * Лимит слотов: серверный, но не больше пяти (аватар — не фото
 * и в слоты не входит, иначе ячеек больше лимита).
 */
const slotLimit = computed(() => {
  const raw = (props.gallery as any)?.limit
  const limit = typeof raw === 'number' ? raw : raw?.value
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1) {
    return ULOVE_PHOTOS_LIMIT
  }
  return Math.min(Math.floor(limit), ULOVE_PHOTOS_LIMIT)
})

/**
 * Слоты строго по факту: фото галереи + ОДИН пустой, если есть место.
 * Пустых впрок не показываем: загрузил одно — появился следующий.
 */
const photoSlots = computed<UlovePhotoSlot[]>(() => {
  const slots: UlovePhotoSlot[] = []

  for (const photo of galleryPhotos.value.slice(0, slotLimit.value)) {
    const url = String(photo?.url ?? '')

    if (url === '') {
      continue
    }

    slots.push({ key: `photo-${photo?.id ?? url}`, url, photoId: typeof photo?.id === 'number' ? photo.id : null, isMain: !!photo?.is_main })
  }

  if (slots.length < slotLimit.value) {
    slots.push({ key: 'empty-add', url: null, photoId: null })
  }

  return slots
})

/**
 * Тап по крестику: первый — взводит подтверждение,
 * второй — удаляет фото из галереи.
 *
 * @param slot слот фото
 */
async function onDeleteSlot(slot: UlovePhotoSlot): Promise<void> {
  if (slot.photoId == null || !props.gallery || deletingIds.value.has(slot.photoId)) {
    return
  }

  if (armDeleteId.value !== slot.photoId) {
    armDeleteId.value = slot.photoId

    if (armTimer) {
      clearTimeout(armTimer)
    }

    armTimer = setTimeout(() => {
      armDeleteId.value = null
      armTimer = null
    }, 2500)

    return
  }

  if (armTimer) {
    clearTimeout(armTimer)
    armTimer = null
  }

  armDeleteId.value = null
  deletingIds.value = new Set([...deletingIds.value, slot.photoId])

  try {
    await props.gallery.remove({ id: slot.photoId })
  } catch {
    toast?.add({ severity: 'error', summary: 'Не удалилось', detail: 'Попробуй ещё раз', life: 3000 })
  } finally {
    const next = new Set(deletingIds.value)
    next.delete(slot.photoId as number)
    deletingIds.value = next
  }
}

const quickTiles = computed(() => [
  { label: 'Анкета', desc: 'Цель, о себе', icon: 'pi pi-user-edit', rose: true, action: 'edit' },
  { label: 'Тариф', desc: p.plan.value === 'free' ? 'Free' : p.plan.value === 'business' ? 'Business активен' : p.plan.value === 'premium' ? 'Premium активен' : 'PRO активен', icon: 'pi pi-crown', rose: false, href: '/settings/billing' },
  { label: 'Приватность', desc: 'Хайды, невидимка', icon: 'pi pi-lock', rose: false, href: '/settings/privacy' },
  { label: 'Приложение', desc: 'Разделы, кэш', icon: 'pi pi-mobile', rose: false, href: '/settings/app' },
])

const cardPhotos = useSwipeCardPhotos(
  () =>
    ({
      photos: props.photos,
      is_pro: p.isPro.value,
    }) as any,
  6000,
)

/**
 * Аватар — фолбэк обложки, когда галереи нет. Бэк зеркалит свежий
 * аватар в галерею главным фото, но фолбэк оставляем на случай
 * пустой или переполненной галереи.
 */
const avatarUrl = computed(() => {
  const url = String(props.profileUser?.avatar_url ?? '')
  return url !== '' ? url : null
})

/**
 * Обложка hero: готовый кадр галереи, иначе аватар,
 * иначе заглушка с инициалом.
 */
const displaySrc = computed(() => cardPhotos.shownPhoto.value ?? avatarUrl.value ?? null)

/**
 * Класс въезда кадра по направлению листания.
 */
const slideClass = computed(() => {
  if (!cardPhotos.shownPhoto.value) {
    return ''
  }
  if (cardPhotos.slideDir.value === 1) {
    return 'hero-enter-left'
  }
  if (cardPhotos.slideDir.value === -1) {
    return 'hero-enter-right'
  }
  return 'hero-enter-fade'
})

const activePrivacyFlags = computed(() => {
  const flags: string[] = []
  const user = props.profileUser ?? {}

  if (user.dating_hide_name) {
    flags.push('Имя скрыто')
  }

  if (user.dating_hide_age) {
    flags.push('Возраст скрыт')
  }

  if (user.dating_hide_distance) {
    flags.push('Расстояние скрыто')
  }

  if (user.dating_match_only) {
    flags.push('Пишут только мэтчи')
  }

  return flags
})
</script>

<template>
  <!-- Мобила — стопка 420px; десктоп — две колонки: липкое фото слева, инфо справа. -->
  <div class="mx-auto w-full max-w-[420px] lg:max-w-[920px] lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-5 lg:items-start">
    <div class="min-w-0 lg:sticky lg:top-20">
    <div class="relative aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200 dark:bg-zinc-800 shadow-soft">
      <div :key="displaySrc ?? 'empty'" :class="slideClass" class="absolute inset-0">
        <AppImage
          v-if="displaySrc"
          :src="displaySrc"
          :alt="p.name.value"
          :img-style="cardPhotos.photoStyle.value"
          :eager="true"
          class="absolute inset-0"
          img-class="absolute inset-0 h-full w-full object-cover will-change-transform"
        />
        <div v-else class="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#FD267D] to-[#FF7854]">
          <span class="text-7xl font-black text-white">{{ p.name.value.slice(0, 1) }}</span>
        </div>
      </div>
      <div v-if="displaySrc && cardPhotos.showPhotoLoader.value" class="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/25" aria-label="Фото загружается">
        <i class="pi pi-spin pi-spinner text-3xl text-white drop-shadow" />
      </div>

      <div
        v-if="cardPhotos.hasMultiple.value"
        class="absolute inset-x-0 top-0 z-20 flex gap-1.5 px-2.5 pt-2.5"
      >
        <button
          v-for="(_, i) in cardPhotos.photos.value"
          :key="i"
          type="button"
          class="flex-1 py-1"
          :aria-label="`Фото ${i + 1}`"
          @pointerdown.stop
          @click="cardPhotos.goTo(i)"
        >
          <span class="block h-1 overflow-hidden rounded-full bg-white/35">
            <span
              :key="`${cardPhotos.photoIndex.value}-${i}`"
              :class="i === cardPhotos.photoIndex.value ? 'hero-dot-fill' : ''"
              class="block h-full rounded-full bg-white transition-all duration-300"
              :style="{
                width: i < cardPhotos.photoIndex.value ? '100%' : i === cardPhotos.photoIndex.value ? undefined : '0%',
                animationDuration: i === cardPhotos.photoIndex.value ? `${cardPhotos.intervalMs}ms` : undefined,
              }"
            />
          </span>
        </button>
      </div>

      <div
        v-if="cardPhotos.hasMultiple.value"
        class="absolute inset-0 z-10 touch-pan-y"
        @pointerdown="cardPhotos.tapDown($event); cardPhotos.dragStart($event)"
        @pointermove="cardPhotos.dragMove($event)"
        @pointerup="cardPhotos.dragEnd(); cardPhotos.tapUp($event)"
        @pointercancel="cardPhotos.dragCancel()"
        @pointerleave="cardPhotos.dragCancel()"
      />

      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div v-if="onlineBadge.visible.value" class="absolute left-4 top-12 z-20 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
        <span :class="onlineBadge.isLive.value ? 'bg-emerald-400' : 'bg-zinc-400'" class="h-1.5 w-1.5 rounded-full" />{{ onlineBadge.text.value }}
      </div>

      <div class="absolute inset-x-0 bottom-0 z-20 p-4 text-white">
        <div class="flex items-baseline gap-2">
          <span class="min-w-0 truncate text-[28px] font-bold leading-none">{{ p.name.value }}</span>
          <span v-if="p.age.value" class="shrink-0 text-[22px] font-light leading-none">{{ p.age.value }}</span>
        </div>
        <div v-if="p.goal.value" class="mt-1.5 truncate text-[15px] text-white/95">💘 {{ p.goal.value }}</div>
      </div>
    </div>
    </div>
    <div class="mt-3 lg:mt-0 min-w-0 space-y-2.5 pb-[calc(1rem+var(--sab))]">
      <div v-if="isOwn && !p.datingEnabled.value" class="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <div class="font-bold text-amber-800 dark:text-amber-200">Анкета скрыта из ленты</div>
        <div class="mt-0.5 text-[13px] text-amber-700 dark:text-amber-300">Тебя никто не видит в свайпах. Включи показ в анкете.</div>
        <Button label="Редактировать анкету" size="small" rounded class="mt-2.5 !border-0 !bg-gradient-to-r !from-[#FD267D] !to-[#FF7854] !text-white" @click="emit('edit')" />
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-soft dark:bg-zinc-900">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            v-for="fact in p.factItems.value"
            :key="fact.label"
            class="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[13px] font-semibold text-stone-600 dark:text-zinc-300"
            :title="fact.label"
          >
            <i :class="fact.icon + ' shrink-0 text-xs text-rose-500'" />
            <span class="truncate">{{ fact.text }}</span>
          </span>
          <span class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-stone-400 dark:bg-zinc-800 dark:text-zinc-500" title="Тариф">
            <i class="pi pi-crown text-[10px]" />{{ p.isPro.value ? 'PRO' : 'Free' }}
          </span>
        </div>
        <p v-if="p.about.value" class="mt-3 border-l-2 border-rose-400 pl-3 text-[15px] leading-relaxed text-stone-800 dark:text-zinc-100">{{ p.about.value }}</p>
        <p v-else class="mt-3 text-sm text-stone-400 dark:text-zinc-500">{{ isOwn ? 'Расскажи о себе — заполни анкету' : 'Человек пока ничего не написал о себе' }}</p>
        <div v-if="p.interests.value.length" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="tag in p.interests.value" :key="tag" class="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-600 dark:border-zinc-700 dark:text-zinc-300">{{ tag }}</span>
        </div>
        <div v-if="isOwn && activePrivacyFlags.length" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="flag in activePrivacyFlags" :key="flag" class="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">🔒 {{ flag }}</span>
        </div>
      </div>

      <div v-if="isOwn && gallery">
        <div class="px-2 text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-zinc-500">
          Мои фото · {{ galleryPhotos.length }} из {{ slotLimit }}
          <i v-if="galleryUploading" class="pi pi-spin pi-spinner ml-1" aria-label="Загрузка фото" />
        </div>
        <div class="mt-1.5 grid grid-cols-5 gap-1.5">
          <div
            v-for="(slot, i) in photoSlots"
            :key="slot.key"
            class="relative aspect-[3/4] overflow-hidden rounded-xl border"
            :class="slot.url ? 'border-transparent' : 'border-dashed border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'"
          >
            <button
              v-if="slot.url"
              type="button"
              :aria-label="`Фото ${i + 1}`"
              class="group absolute inset-0 h-full w-full active:scale-95 transition"
              @click="emit('photos')"
            >
              <AppImage :src="slot.url" :alt="`Фото ${i + 1}`" class="absolute inset-0" img-class="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.06]" />
            </button>
            <button
              v-else
              type="button"
              aria-label="Добавить фото"
              title="Добавить фото"
              :disabled="galleryUploading"
              class="group absolute inset-0 grid h-full w-full place-items-center text-stone-300 transition active:scale-95 disabled:opacity-70 hover:border-rose-400 hover:bg-rose-500/[0.07] hover:text-rose-500 hover:shadow-lg hover:shadow-rose-500/20 dark:text-zinc-600 dark:hover:border-rose-500/60 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              @click="emit('add-photos')"
            >
              <span class="grid h-8 w-8 place-items-center rounded-full bg-stone-100 transition group-hover:scale-110 group-hover:bg-rose-500 group-hover:text-white group-hover:shadow-md group-hover:shadow-rose-500/40 dark:bg-zinc-800"><i class="pi pi-plus text-sm" /></span>
            </button>
            <span v-if="slot.url && (slot.isMain || i === 0)" title="Главная" aria-label="Главная фотография" class="pointer-events-none absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white"><i class="pi pi-star-fill text-[9px]" /></span>
            <button
              v-if="slot.url && slot.photoId != null"
              type="button"
              :aria-label="armDeleteId === slot.photoId ? 'Подтвердить удаление' : 'Удалить фото'"
              class="absolute right-1 top-1 grid h-7 min-w-7 place-items-center rounded-full text-white shadow active:scale-90 transition"
              :class="armDeleteId === slot.photoId ? 'bg-red-500 px-2 text-[10px] font-black' : 'w-7 bg-black/55'"
              @click.stop="onDeleteSlot(slot)"
            >
              <i v-if="slot.photoId != null && deletingIds.has(slot.photoId)" class="pi pi-spin pi-spinner text-xs" />
              <span v-else-if="armDeleteId === slot.photoId">Точно?</span>
              <i v-else class="pi pi-times text-xs" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="isOwn" class="grid grid-cols-2 gap-2">
        <template v-for="tile in quickTiles" :key="tile.label">
          <button
            v-if="tile.action === 'edit'"
            type="button"
            class="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#FD267D] to-[#FF7854] p-3 text-left text-white shadow-lg shadow-rose-500/30 active:scale-[0.98] transition"
            @click="emit('edit')"
          >
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20"><i :class="[tile.icon, 'text-sm']" /></span>
            <span class="min-w-0"><span class="block truncate text-sm font-black">{{ tile.label }}</span><span class="block truncate text-[11px] text-white/80">{{ tile.desc }}</span></span>
          </button>
          <Link v-else :href="tile.href" class="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white p-3 text-left shadow-soft active:scale-[0.98] transition dark:border-zinc-800 dark:bg-zinc-900">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-300"><i :class="[tile.icon, 'text-sm']" /></span>
            <span class="min-w-0"><span class="block truncate text-sm font-black text-stone-900 dark:text-white">{{ tile.label }}</span><span class="block truncate text-[11px] text-stone-500 dark:text-zinc-400">{{ tile.desc }}</span></span>
          </Link>
        </template>
      </div>
      <div v-else class="flex gap-2">
        <Button
          :label="p.liked.value ? 'Лайк отправлен ♥' : 'Лайк'"
          icon="pi pi-heart-fill"
          rounded
          :loading="p.liking.value"
          :disabled="p.liked.value"
          class="flex-1 !border-0 !bg-gradient-to-r !from-[#FD267D] !to-[#FF7854] !py-3 !text-white shadow-lg shadow-rose-500/30 disabled:!opacity-70"
          @click="p.like(profileUser?.id ?? null)"
        />
        <Button
          label="Написать"
          icon="pi pi-send"
          rounded
          outlined
          :disabled="!canMessage"
          :title="canMessageReason ?? undefined"
          class="flex-1 !py-3"
          @click="emit('message')"
        />
      </div>
      <Link
        v-if="p.matched.value"
        :href="p.matchedConversationId.value ? `/chat/${p.matchedConversationId.value}?from=swipes` : '/swipes'"
        class="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FD267D] via-[#E936C7] to-[#FF7854] px-4 py-3 text-sm font-black text-white shadow-lg shadow-rose-500/30 active:scale-[0.99] transition"
      >
        <i class="pi pi-heart-fill text-sm" /> Это мэтч! Открыть чат →
      </Link>
      <Message v-if="p.likeError.value" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ p.likeError.value }}</Message>
      <div v-if="!isOwn && !canMessage && canMessageReason" class="text-center text-xs text-stone-400 dark:text-zinc-500">{{ canMessageReason }}</div>
    </div>
  </div>
</template>

<style scoped>
.hero-enter-left { animation: hero-in-left 0.32s cubic-bezier(0.2, 0.7, 0.25, 1); }
.hero-enter-right { animation: hero-in-right 0.32s cubic-bezier(0.2, 0.7, 0.25, 1); }
.hero-enter-fade { animation: hero-in-fade 0.3s ease; }
.hero-dot-fill {
  width: 0%;
  animation-name: hero-dot-fill;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
@keyframes hero-in-left { from { transform: translateX(64px); opacity: 0.35; } to { transform: translateX(0); opacity: 1; } }
@keyframes hero-in-right { from { transform: translateX(-64px); opacity: 0.35; } to { transform: translateX(0); opacity: 1; } }
@keyframes hero-in-fade { from { opacity: 0.2; } to { opacity: 1; } }
@keyframes hero-dot-fill { from { width: 0%; } to { width: 100%; } }
@media (prefers-reduced-motion: reduce) {
  .hero-enter-left, .hero-enter-right, .hero-enter-fade { animation: none; }
}
</style>
