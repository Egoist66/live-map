<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ isOwn?: boolean }>(), { isOwn: true })

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
    tile: '!border-blue-200 !bg-blue-600/10 hover:!bg-blue-600/20 dark:!border-blue-500/25 dark:!bg-blue-500/15 dark:hover:!bg-blue-500/25',
    iconColor: '!text-blue-600 dark:!text-blue-400',
  },
  {
    key: 'friends',
    label: 'Друзья',
    icon: 'pi pi-users',
    tile: '!border-emerald-200 !bg-emerald-600/10 hover:!bg-emerald-600/20 dark:!border-emerald-500/25 dark:!bg-emerald-500/15 dark:hover:!bg-emerald-500/25',
    iconColor: '!text-emerald-600 dark:!text-emerald-400',
  },
  {
    key: 'search',
    label: 'Поиск',
    icon: 'pi pi-search',
    tile: '!border-amber-200 !bg-amber-500/10 hover:!bg-amber-500/20 dark:!border-amber-500/25 dark:!bg-amber-500/15 dark:hover:!bg-amber-500/25',
    iconColor: '!text-amber-600 dark:!text-amber-400',
  },
  {
    key: 'share',
    label: 'Поделиться',
    icon: 'pi pi-share-alt',
    tile: '!border-violet-200 !bg-violet-600/10 hover:!bg-violet-600/20 dark:!border-violet-500/25 dark:!bg-violet-500/15 dark:hover:!bg-violet-500/25',
    iconColor: '!text-violet-600 dark:!text-violet-300',
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
  <nav aria-label="Быстрые действия профиля" class="grid gap-2 sm:gap-3" :class="actions.length === 4 ? 'grid-cols-4' : 'grid-cols-3'">
    <div v-for="action in actions" :key="action.key" class="flex min-w-0 flex-col items-center gap-1.5">
      <button
        type="button"
        :aria-label="action.label"
        :class="['grid h-16 w-full min-[411px]:h-20 sm:h-28 place-items-center rounded-[16px] min-[411px]:rounded-[20px] border shadow-soft transition active:scale-95', action.tile]"
        @click="onAction(action.key)"
      >
        <i :class="[action.icon, action.iconColor, 'text-xl min-[411px]:text-2xl sm:text-5xl']"></i>
      </button>
      <span class="truncate text-xs sm:text-[13px] font-medium text-stone-500 dark:text-zinc-400">{{ action.label }}</span>
    </div>
  </nav>
</template>
