<script setup lang="ts">
import { computed, toRef } from 'vue'
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import { useChatPeerPanelTheme, type ChatPeerTone } from '@/composables/useChatPeerPanelTheme'

const props = withDefaults(
  defineProps<{
    peer: any
    badge?: string | null
    profileUrl?: string | null
    variant?: ChatPeerTone
  }>(),
  { badge: null, profileUrl: null, variant: 'ulove' },
)

const emit = defineEmits<{ (e: 'block'): void }>()

const theme = useChatPeerPanelTheme(toRef(props, 'variant'))

const goalLabel = computed(() => {
  const map: Record<string, string> = {
    love: 'Отношения',
    flirt: 'Флирт',
    friendship: 'Дружба',
    chat: 'Общение',
    interests: 'По интересам',
  }
  const goal = props.peer?.dating_goal ?? null

  if (!goal) {
    return null
  }

  return map[String(goal)] ?? String(goal)
})

const interests = computed<string[]>(() => {
  const raw = props.peer?.dating_interests

  if (!Array.isArray(raw)) {
    return []
  }

  return raw.map((tag) => String(tag)).filter((tag) => tag !== '').slice(0, 6)
})

const isMatch = computed(() => !!props.peer?.is_match)
const initial = computed(() => String(props.peer?.name ?? '?').slice(0, 1))
</script>

<template>
  <aside class="hidden min-h-0 w-[280px] shrink-0 flex-col overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 xl:flex dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex flex-col items-center text-center">
      <span :class="['block rounded-full p-1', isMatch ? theme.ring : 'bg-stone-200 dark:bg-zinc-700']">
        <Avatar :image="peer?.avatar_url ?? undefined" :label="!peer?.avatar_url ? initial : undefined" shape="circle" class="!h-24 !w-24 !text-3xl" />
      </span>
      <div class="mt-3 max-w-full truncate text-xl font-bold text-stone-900 dark:text-white">{{ peer?.name ?? 'Собеседник' }}</div>
      <span v-if="badge" :class="['mt-1.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black text-white', theme.badge]">💞 {{ badge }}</span>
      <span v-else-if="isMatch" :class="['mt-1.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black', theme.match]">♥ Мэтч</span>
    </div>

    <div v-if="goalLabel || interests.length" class="mt-5 border-t border-stone-100 pt-4 dark:border-zinc-800">
      <div class="text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-zinc-500">{{ theme.sectionTitle }}</div>
      <div v-if="goalLabel" class="mt-2 text-sm font-semibold text-stone-700 dark:text-zinc-200">💘 {{ goalLabel }}</div>
      <div v-if="interests.length" class="mt-2 flex flex-wrap justify-center gap-1.5">
        <span v-for="tag in interests" :key="tag" class="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">{{ tag }}</span>
      </div>
    </div>

    <div class="mt-5 space-y-2 border-t border-stone-100 pt-4 dark:border-zinc-800">
      <Link v-if="profileUrl" :href="profileUrl" class="block">
        <Button label="Открыть профиль" icon="pi pi-user" rounded :class="['w-full !border-0 !text-white', theme.cta]" />
      </Link>
      <Button label="Заблокировать" icon="pi pi-ban" rounded outlined severity="danger" size="small" class="w-full" @click="emit('block')" />
    </div>
  </aside>
</template>
