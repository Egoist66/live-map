<script setup lang="ts">
import { usePush } from '@/composables/usePush'

const { supported, permission, subscribed, loading, toggle, test } = usePush()
</script>

<template>
  <div v-if="supported" class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
    <i class="pi pi-bell text-lg text-indigo-500 shrink-0" />
    <div class="flex-1 text-sm">
      <p class="font-semibold">Системные уведомления</p>
      <p class="text-xs opacity-60">
        <span v-if="permission === 'denied'">заблокированы в браузере</span>
        <span v-else-if="subscribed">включены, даже когда вкладка закрыта</span>
        <span v-else>о сообщениях и друзьях</span>
      </p>
    </div>
    <button
      v-if="subscribed"
      class="text-xs font-semibold px-3 py-2 rounded-xl border border-stone-300 dark:border-zinc-700 active:scale-95"
      @click="test"
    >
      Тест
    </button>
    <button
      class="text-xs font-semibold px-3 py-2 rounded-xl active:scale-95"
      :class="subscribed ? 'bg-stone-200 dark:bg-zinc-800' : 'bg-indigo-500 text-white'"
      :disabled="loading || permission === 'denied'"
      @click="toggle"
    >
      {{ loading ? '…' : subscribed ? 'Выкл' : 'Вкл' }}
    </button>
  </div>
</template>
