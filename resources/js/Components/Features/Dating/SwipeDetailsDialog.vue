<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { useMounted } from '@vueuse/core'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import Dialog from 'primevue/dialog'
import { useProfileUrl } from '@/composables/useProfileUrl'
import { usePresenceState } from '@/composables/usePresence'
import { formatRelative } from '@/utils/date'
import type { SwipeCard } from '@/services/dating.api'

const props = defineProps<{ card: SwipeCard | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { userProfileUrl } = useProfileUrl()
const { isOnline } = usePresenceState()
const mounted = useMounted()

const open = computed(() => !!props.card)

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
    header="Анкета"
    :style="{ width: '420px', maxWidth: '94vw', maxHeight: '92dvh' }"
    :pt="{ root: { class: '!rounded-3xl !overflow-hidden dark:!bg-zinc-900 dark:!border-zinc-700' }, header: { class: 'dark:!bg-zinc-900 dark:!text-white' }, content: { class: 'dark:!bg-zinc-900 dark:!text-zinc-100 !max-h-[78dvh] !overflow-y-auto' } }"
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
          <div v-if="card.city || card.distance_km != null" class="text-xs text-stone-500 dark:text-zinc-400 truncate">
            {{ [card.city, card.distance_km != null ? `${card.distance_km} км` : null].filter(Boolean).join(' · ') }}
          </div>
          <div class="mt-1 flex items-center gap-1.5 text-xs font-semibold" :class="peerOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-zinc-500'">
            <span :class="peerOnline ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'" class="h-1.5 w-1.5 rounded-full" />{{ presenceLabel }}
          </div>
        </div>
      </div>

      <div class="mt-3">
        <Chip :label="goalShort(card)" icon="pi pi-heart-fill" class="!rounded-full !bg-rose-500 !text-white !border-0 text-xs" />
      </div>

      <div v-if="card.about" class="mt-3">
        <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">О себе</div>
        <p class="mt-1 text-sm leading-relaxed text-stone-700 dark:text-zinc-200 whitespace-pre-wrap break-words">{{ card.about }}</p>
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
        <p class="mt-1 text-sm text-stone-600 dark:text-zinc-300 line-clamp-4">{{ card.bio }}</p>
      </div>

      <Button label="Закрыть" rounded outlined severity="secondary" class="w-full mt-5" @click="emit('close')" />
    </div>
  </Dialog>
</template>
