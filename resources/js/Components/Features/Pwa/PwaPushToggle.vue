<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { usePush } from '@/composables/usePush'

const { supported, permission, subscribed, loading, pushError, toggle, test } = usePush()
const toast = (() => { try { return useToast() } catch { return null as any } })()

async function onToggle() {
  const ok = await toggle()
  if (!ok && pushError.value) toast?.add({ severity: 'error', summary: 'Уведомления не включились', detail: pushError.value, life: 5000 })
  else if (ok && subscribed.value) toast?.add({ severity: 'success', summary: 'Включено', detail: 'Системные уведомления будут приходить даже на заблокированный экран', life: 3500 })
}
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
      <p v-if="pushError" class="text-xs text-red-500 mt-1">{{ pushError }}</p>
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
      @click="onToggle"
    >
      {{ loading ? '…' : subscribed ? 'Выкл' : 'Вкл' }}
    </button>
  </div>
</template>
