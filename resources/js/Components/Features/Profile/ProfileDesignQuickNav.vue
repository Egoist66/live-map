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

const allActions: Array<{ key: QuickNavKey; label: string; icon: string }> = [
  { key: 'profile', label: 'Профиль', icon: 'pi pi-user' },
  { key: 'friends', label: 'Друзья', icon: 'pi pi-users' },
  { key: 'search', label: 'Поиск', icon: 'pi pi-search' },
  { key: 'share', label: 'Поделиться', icon: 'pi pi-share-alt' },
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
        class="grid h-16 w-full sm:h-[72px] place-items-center rounded-[18px] border border-stone-200 bg-white shadow-soft text-stone-500 transition hover:bg-stone-50 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        @click="onAction(action.key)"
      >
        <i :class="[action.icon, 'text-xl sm:text-2xl']"></i>
      </button>
      <span class="truncate text-[11px] sm:text-xs font-medium text-stone-500 dark:text-zinc-400">{{ action.label }}</span>
    </div>
  </nav>
</template>
