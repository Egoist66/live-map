<script setup lang="ts">
import { computed, toRef } from 'vue'
import { Link } from '@inertiajs/vue3'
import { useMounted } from '@vueuse/core'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { useProfileUrl } from '@/composables/useProfileUrl'
import { useSwipeTrustWarning } from '@/composables/useSwipeTrustWarning'
import { usePresenceState } from '@/composables/usePresence'
import { useViewportBreakpoints } from '@/composables/useViewportBreakpoints'
import { formatRelative } from '@/utils/date'
import { formatCardLocation } from '@/utils/place'
import DatingFriendButton from '@/Components/Features/Dating/DatingFriendButton.vue'
import DatingReviewsSection from '@/Components/Features/Dating/DatingReviewsSection.vue'
import ModeratedContent from '@/Components/Features/Moderation/ModeratedContent.vue'
import type { SwipeCard } from '@/services/dating.api'

const props = defineProps<{ card: SwipeCard | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { userProfileUrl } = useProfileUrl()
const { isOnline } = usePresenceState()
const { isMobile } = useViewportBreakpoints()
const mounted = useMounted()

const open = computed(() => !!props.card)
const cardRef = toRef(props, 'card')
const trustWarn = useSwipeTrustWarning(cardRef)

/**
 * Онлайн-статус анкеты: presence-канал + свежесть last_seen_at.
 */
const peerOnline = computed(() => {
  if (!props.card || props.card.id == null) return false
  try {
    return isOnline(props.card.id, props.card.last_seen_at)
  } catch {
    return false
  }
})

/**
 * Подпись присутствия: «в сети» либо относительное время.
 * Время считаем только после mount (SSR mismatch у границы минуты).
 */
const presenceLabel = computed(() => {
  if (peerOnline.value) return 'в сети'
  if (!mounted.value || !props.card?.last_seen_at) return 'оффлайн'
  try {
    return formatRelative(props.card.last_seen_at)
  } catch {
    return 'оффлайн'
  }
})

function goalShort(card: SwipeCard): string {
  const custom = (card.custom_goal ?? '').trim()
  if (custom) return custom
  const map: Record<string, string> = {
    love: 'Ищу отношения',
    flirt: 'Ищу флирт',
    friendship: 'Ищу дружбу',
    chat: 'Ищу общение',
    interests: 'Ищу по интересам',
  }
  return map[card.goal ?? ''] ?? 'Цель не указана'
}

function ageText(card: SwipeCard): string {
  if (card.age != null) return `${card.age}`
  return card.age_hidden ? 'возраст скрыт' : 'возраст не указан'
}
</script>

<template>
  <Dialog
    :visible="open"
    @update:visible="(v:boolean)=>{ if(!v) emit('close') }"
    modal
    :draggable="false"
    :block-scroll="true"
    :position="isMobile ? 'bottom' : 'center'"
    :breakpoints="{ '640px': '100vw' }"
    header="Анкета"
    :style="{ width: '420px', maxWidth: '94vw', maxHeight: '92dvh' }"
    :pt="{ root: { class: 'swipe-details-sheet !rounded-3xl max-sm:!rounded-b-none !overflow-hidden dark:!bg-zinc-900 dark:!border-zinc-700' }, header: { class: 'dark:!bg-zinc-900 dark:!text-white' }, content: { class: 'dark:!bg-zinc-900 dark:!text-zinc-100 !max-h-[78dvh] !overflow-y-auto overscroll-contain' } }"
  >
    <div v-if="card" class="pt-1">
      <div class="flex items-center gap-3">
        <Avatar :image="card.avatar_url ?? undefined" :label="!card.avatar_url ? (card.name ?? '?').slice(0, 1) : undefined" shape="circle" size="xlarge" class="!w-16 !h-16" />
        <div class="min-w-0">
          <Link
            v-if="card.id != null"
            :href="userProfileUrl(card)"
            class="text-lg font-black truncate text-stone-900 dark:text-white hover:underline"
            title="Открыть профиль"
          >{{ card.name }} · {{ ageText(card) }}</Link>
          <div v-else class="text-lg font-black truncate text-stone-900 dark:text-white">{{ card.name }} · {{ ageText(card) }}</div>
          <div v-if="formatCardLocation(card) || card.distance_km != null" class="text-xs text-stone-500 dark:text-zinc-400 truncate">
            {{ [formatCardLocation(card), card.distance_km != null ? `${card.distance_km} км` : null].filter(Boolean).join(' · ') }}
          </div>
          <div class="mt-1 flex items-center gap-1.5 text-xs font-semibold" :class="peerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-zinc-500'">
            <span :class="peerOnline ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'" class="h-1.5 w-1.5 rounded-full" />{{ presenceLabel }}
          </div>
        </div>
      </div>

      <div class="mt-3">
        <Chip :label="goalShort(card)" icon="pi pi-heart-fill" class="!rounded-full !bg-rose-500 !text-white !border-0 text-xs" />
      </div>

      <Message v-if="trustWarn.show.value" severity="warn" :closable="false" class="!rounded-2xl !mt-3 !text-xs">
        <div class="flex items-start gap-2">
          <i class="pi pi-exclamation-triangle !text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
          <div class="min-w-0">
            <div class="font-black text-amber-700 dark:text-amber-300">Осторожно: низкая репутация</div>
            <div class="mt-0.5 font-semibold text-amber-700 dark:text-amber-300">{{ trustWarn.numbersLine.value }}</div>
            <div class="mt-1 leading-snug text-stone-600 dark:text-zinc-300">У этого профиля много жалоб, блокировок или плохих отзывов. Подумай перед лайком и встречей.</div>
            <Link :href="trustWarn.faqHref" class="mt-1.5 inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 hover:underline">
              <span>Что это значит — раздел FAQ</span>
              <i class="pi pi-arrow-right text-[10px]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Message>

      <div v-if="card.id != null" class="mt-3">
        <DatingFriendButton :user-id="card.id" />
      </div>

      <div v-if="card.about" class="mt-3">
        <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">О себе</div>
        <ModeratedContent :text="String(card.about || '')" :moderation="(card as any)?.moderation ?? null">
          <p class="mt-1 text-sm leading-relaxed text-stone-700 dark:text-zinc-200 whitespace-pre-wrap break-words">{{ card.about }}</p>
        </ModeratedContent>
      </div>
      <div v-else class="mt-3 text-sm text-stone-400 dark:text-zinc-500">Человек пока не рассказал о себе.</div>

      <div v-if="card.interests.length" class="mt-3">
        <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Интересы · что любит</div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <Chip v-for="t in card.interests" :key="t" :label="`#${t}`" class="!rounded-full text-xs" />
        </div>
      </div>

      <div v-if="card.bio" class="mt-3">
        <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">Из профиля</div>
        <ModeratedContent :text="String(card.bio || '')" :moderation="(card as any)?.moderation ?? null">
          <p class="mt-1 text-sm text-stone-600 dark:text-zinc-300 line-clamp-4">{{ card.bio }}</p>
        </ModeratedContent>
      </div>

      <DatingReviewsSection
        v-if="card.id != null"
        :user-id="card.id"
        :seed-avg="card.rating_avg ?? null"
        :seed-count="card.rating_count ?? 0"
        :seed-hidden="card.rating_hidden ?? false"
      />

      <Button label="Закрыть" rounded outlined severity="secondary" class="w-full mt-5" @click="emit('close')" />
    </div>
  </Dialog>
</template>

<style scoped>
/* Мобила: шторка снизу на всю ширину — интересы, о себе и отзывы
   читаются как лист, safe-area под home-индикатором учтена. */
@media (max-width: 639.98px) {
  .swipe-details-sheet {
    margin: 0 0 env(safe-area-inset-bottom, 0px) !important;
    border-radius: 28px 28px 0 0 !important;
    max-height: 92dvh;
  }
}
</style>
