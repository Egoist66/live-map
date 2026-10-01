<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useTelegramAccount } from '@/composables/useTelegramAccount'

const acc = useTelegramAccount()
</script>

<template>
  <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
    <i class="pi pi-users text-lg text-violet-500 shrink-0" />
    <div class="flex-1 text-sm min-w-0">
      <p class="font-semibold dark:text-white">Второй аккаунт в боте</p>
      <p class="text-xs opacity-60">Есть аккаунт с сайта? Сгенерируйте код и пришлите его боту — он переключится сюда.</p>

      <div v-if="acc.code.value" class="mt-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60 px-3 py-2.5">
        <p class="text-xs opacity-60">Код для бота (одноразовый, 10 минут):</p>
        <p class="mt-1 text-2xl font-black tracking-[0.3em] dark:text-white select-all">{{ acc.code.value }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <Button label="Новый код" icon="pi pi-refresh" size="small" outlined rounded :loading="acc.loading.value" @click="acc.generateSwitchCode()" />
          <Button label="Убрать с экрана" icon="pi pi-eye-slash" size="small" text rounded @click="acc.clearCode()" />
        </div>
      </div>

      <div v-else class="mt-3">
        <Button label="Сгенерировать код" icon="pi pi-key" size="small" rounded :loading="acc.loading.value" @click="acc.generateSwitchCode()" />
      </div>

      <Message v-if="acc.errorMessage.value" severity="error" class="mt-2 !text-xs">{{ acc.errorMessage.value }}</Message>
    </div>
  </div>
</template>
