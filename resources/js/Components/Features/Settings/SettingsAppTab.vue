<script setup lang="ts">
import Card from 'primevue/card'
import { useToast } from 'primevue/usetoast'
import { usePwaSettings } from '@/composables/usePwaSettings'
import PwaPushToggle from '@/Components/Features/Pwa/PwaPushToggle.vue'

const s = usePwaSettings()
const toast = (() => { try { return useToast() } catch { return null as any } })()

async function onClearCache() {
  await s.clearCache()
  if (s.lastCleared.value) toast?.add({ severity: 'success', summary: 'Офлайн-кэш', detail: s.lastCleared.value, life: 3500 })
}
</script>

<template>
  <div class="space-y-4">
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Приложение</h3>
        <p class="text-sm text-stone-500 mt-1">Установка, офлайн-режим и уведомления на этом устройстве.</p>
        <div class="mt-6 space-y-4 max-w-xl">
          <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
            <i class="pi pi-mobile text-lg text-indigo-500 shrink-0" />
            <div class="flex-1 text-sm">
              <p class="font-semibold dark:text-white">Режим приложения</p>
              <p class="text-xs opacity-60">
                <span v-if="s.standalone.value">запущено как установленное приложение</span>
                <span v-else>открыто в браузере</span>
                <span v-if="!s.online.value"> · сейчас офлайн</span>
              </p>
            </div>
            <button
              v-if="s.canInstall.value && !s.standalone.value"
              class="text-xs font-semibold px-3 py-2 rounded-xl bg-indigo-500 text-white active:scale-95"
              @click="s.promptInstall()"
            >
              Установить
            </button>
            <span v-else class="text-xs font-semibold px-3 py-2 rounded-xl bg-stone-100 dark:bg-zinc-800 dark:text-white">
              {{ s.standalone.value ? 'Установлено' : s.supported.value ? 'Готово к установке' : 'Браузер' }}
            </span>
          </div>

          <PwaPushToggle />

          <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
            <i class="pi pi-database text-lg text-indigo-500 shrink-0" />
            <div class="flex-1 text-sm">
              <p class="font-semibold dark:text-white">Офлайн-кэш</p>
              <p class="text-xs opacity-60">
                <span v-if="s.usage.value">занято {{ s.usage.value.usageMB.toFixed(1) }} МБ · карта и фото открываются без сети</span>
                <span v-else>карта и фото открываются без сети</span>
              </p>
              <p v-if="s.lastCleared.value" class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{{ s.lastCleared.value }}</p>
            </div>
            <button
              class="text-xs font-semibold px-3 py-2 rounded-xl bg-stone-200 dark:bg-zinc-800 dark:text-white active:scale-95"
              :disabled="s.clearing.value"
              @click="onClearCache"
            >
              {{ s.clearing.value ? '…' : 'Очистить' }}
            </button>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
