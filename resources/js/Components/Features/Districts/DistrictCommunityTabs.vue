<script setup lang="ts">
import Badge from 'primevue/badge'

defineProps<{
  active: 'feed' | 'members' | 'info' | 'requests'
  membersCount: number
  requestsCount: number
  showRequests: boolean
}>()

const emit = defineEmits<{
  (e: 'select', tab: 'feed' | 'members' | 'info' | 'requests'): void
}>()

/**
 * Класс таба сообщества: синяя черта активного, как в профиле.
 *
 * @param isActive активен ли таб
 */
function tabClass(isActive: boolean): string {
  const base = 'shrink-0 whitespace-nowrap px-3 sm:px-4 py-3 text-[13px] sm:text-sm font-bold border-b-[3px] -mb-px transition'
  const active = 'border-blue-600 text-blue-600 dark:text-blue-400'
  const idle = 'border-transparent text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-zinc-200'
  return `${base} ${isActive ? active : idle}`
}
</script>

<template>
  <div class="flex gap-1 overflow-x-auto border-b border-stone-200/70 bg-white px-2 [scrollbar-width:none] sm:gap-2 sm:rounded-3xl sm:border sm:px-4 dark:border-zinc-800 dark:bg-zinc-900 [&::-webkit-scrollbar]:hidden">
    <button type="button" :class="tabClass(active === 'feed')" @click="emit('select', 'feed')">
      Лента
    </button>
    <button type="button" :class="tabClass(active === 'members')" @click="emit('select', 'members')">
      Участники · {{ membersCount }}
    </button>
    <button type="button" :class="tabClass(active === 'info')" @click="emit('select', 'info')">
      Информация
    </button>
    <button v-if="showRequests" type="button" :class="tabClass(active === 'requests')" @click="emit('select', 'requests')">
      <span class="flex items-center gap-1.5">
        Заявки
        <Badge v-if="requestsCount > 0" :value="String(requestsCount)" severity="danger" class="!min-w-[20px] !text-[10px]" />
      </span>
    </button>
  </div>
</template>
