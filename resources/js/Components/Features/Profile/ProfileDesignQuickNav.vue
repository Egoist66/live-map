<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    isOwn?: boolean
    /** tiles — плитка для мобайла, sidebar — вертикальное меню для десктоп-сайдбара. */
    variant?: 'tiles' | 'sidebar'
  }>(),
  { isOwn: true, variant: 'tiles' },
)

const emit = defineEmits<{
  (e: 'profile'): void
  (e: 'friends'): void
  (e: 'search'): void
  (e: 'share'): void
}>()

type QuickNavKey = 'profile' | 'friends' | 'search' | 'share'

const allActions: Array<{ key: QuickNavKey; label: string; icon: string; tile: string; iconColor: string }> = [
  {
    key: 'profile',
    label: 'Профиль',
    icon: 'pi pi-user',
    tile: '!border-0 !bg-gradient-to-br !from-blue-500 !to-indigo-600 hover:!from-blue-400 hover:!to-indigo-500 shadow-[0_8px_20px_-8px_rgba(59,130,246,0.7)]',
    iconColor: '!text-white',
  },
  {
    key: 'friends',
    label: 'Друзья',
    icon: 'pi pi-users',
    tile: '!border-0 !bg-gradient-to-br !from-emerald-500 !to-teal-600 hover:!from-emerald-400 hover:!to-teal-500 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)]',
    iconColor: '!text-white',
  },
  {
    key: 'search',
    label: 'Поиск',
    icon: 'pi pi-search',
    tile: '!border-0 !bg-gradient-to-br !from-amber-400 !to-orange-500 hover:!from-amber-300 hover:!to-orange-400 shadow-[0_8px_20px_-8px_rgba(245,158,11,0.7)]',
    iconColor: '!text-white',
  },
  {
    key: 'share',
    label: 'Поделиться',
    icon: 'pi pi-share-alt',
    tile: '!border-0 !bg-gradient-to-br !from-violet-500 !to-fuchsia-600 hover:!from-violet-400 hover:!to-fuchsia-500 shadow-[0_8px_20px_-8px_rgba(139,92,246,0.7)]',
    iconColor: '!text-white',
  },
]

/** Поиск людей — только из своего профиля, в чужом его нет. */
const actions = computed(() => {
  const isOwnProfile = props.isOwn
  if (isOwnProfile) return allActions
  return allActions.filter((action) => action.key !== 'search')
})

/**
 * Прокидывает нажатие наружу отдельным событием под каждый ключ.
 * @param key ключ действия
 */
function onAction(key: QuickNavKey): void {
  if (key === 'profile') emit('profile')
  else if (key === 'friends') emit('friends')
  else if (key === 'search') emit('search')
  else emit('share')
}
</script>

<template>
  <nav
    v-if="variant === 'sidebar'"
    aria-label="Меню профиля"
    class="rounded-[24px] border border-stone-200 bg-white shadow-soft p-2 dark:border-zinc-800 dark:bg-zinc-900"
  >
    <button
      v-for="action in actions"
      :key="action.key"
      type="button"
      class="group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-stone-100 active:scale-[0.99] dark:hover:bg-white/[0.06]"
      @click="onAction(action.key)"
    >
      <span :class="['grid h-10 w-10 shrink-0 place-items-center rounded-xl border', action.tile]">
        <i :class="[action.icon, action.iconColor, 'text-base drop-shadow']"></i>
      </span>
      <span class="min-w-0 flex-1 truncate text-sm font-bold text-ink-900 dark:text-zinc-100">{{ action.label }}</span>
      <i class="pi pi-chevron-right shrink-0 text-xs text-stone-300 transition group-hover:translate-x-0.5 dark:text-zinc-600"></i>
    </button>
  </nav>

  <nav v-else aria-label="Быстрые действия профиля" class="grid gap-2 sm:gap-3" :class="actions.length === 4 ? 'grid-cols-4' : 'grid-cols-3'">
    <div v-for="action in actions" :key="action.key" class="flex min-w-0 flex-col items-center gap-1.5">
      <button
        type="button"
        :aria-label="action.label"
        :class="['grid h-16 w-full min-[411px]:h-[72px] sm:h-20 place-items-center rounded-[16px] min-[411px]:rounded-[20px] border transition active:scale-95', action.tile]"
        @click="onAction(action.key)"
      >
        <i :class="[action.icon, action.iconColor, 'text-xl min-[411px]:text-2xl sm:text-3xl drop-shadow']"></i>
      </button>
      <span class="truncate text-xs sm:text-[13px] font-medium text-stone-500 dark:text-zinc-400">{{ action.label }}</span>
    </div>
  </nav>
</template>
