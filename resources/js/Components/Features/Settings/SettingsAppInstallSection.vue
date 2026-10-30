<script setup lang="ts">
import Card from 'primevue/card'
import { useToast } from 'primevue/usetoast'
import { usePwaSettings } from '@/composables/usePwaSettings'
import { usePwaInstallGuide } from '@/composables/usePwaInstallGuide'

/**
 * Подвкладка «Установка»: режим PWA (браузер / установлено) и
 * оффлайн-кэш (карта и фото без сети + очистка).
 * Вся логика — в usePwaSettings / usePwaInstallGuide (Правило №1).
 */
const s = usePwaSettings()
const guide = usePwaInstallGuide()
const toast = (() => {
  try {
    return useToast()
  } catch {
    return null as any
  }
})()

/**
 * Очистить оффлайн-кэш с тостом-подтверждением.
 */
async function onClearCache(): Promise<void> {
  await s.clearCache()
  if (s.lastCleared.value) {
    toast?.add({ severity: 'success', summary: 'Оффлайн-кэш', detail: s.lastCleared.value, life: 3500 })
  }
}
</script>

<template>
  <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 dark:!border-white/10 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Установка и кэш</h3>
      <p class="text-sm text-stone-500 mt-1">Установка как приложение и оффлайн-режим на этом устройстве.</p>
      <div class="mt-6 space-y-4 max-w-xl">
        <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-white/10 px-4 py-3">
          <i class="pi pi-mobile text-lg text-indigo-500 shrink-0" />
          <div class="flex-1 text-sm min-w-0">
            <p class="font-semibold dark:text-white">Режим приложения</p>
            <p class="text-xs opacity-60">
              <span v-if="s.standalone.value">запущено как установленное приложение</span>
              <span v-else>открыто в браузере</span>
              <span v-if="!s.online.value"> · сейчас оффлайн</span>
            </p>
          </div>
          <button
            v-if="!s.standalone.value"
            class="text-xs font-semibold px-3 py-2 rounded-xl bg-indigo-500 text-white hover:opacity-90 active:scale-95 shrink-0 disabled:opacity-60"
            :disabled="guide.installing.value"
            @click="guide.install()"
          >
            {{ guide.installing.value ? '…' : s.canInstall.value ? 'Установить' : 'Как установить' }}
          </button>
          <span v-else class="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
            Установлено
          </span>
        </div>
        <p v-if="!s.standalone.value" class="text-xs text-stone-500 dark:text-zinc-400 -mt-2">
          {{ s.canInstall.value ? 'Готово к установке в один клик.' : 'Покажем инструкцию под твое устройство.' }}
        </p>

        <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-white/10 px-4 py-3">
          <i class="pi pi-database text-lg text-indigo-500 shrink-0" />
          <div class="flex-1 text-sm min-w-0">
            <p class="font-semibold dark:text-white">Оффлайн-кэш</p>
            <p class="text-xs opacity-60">
              <span v-if="s.usage.value">занято {{ s.usage.value.usageMB.toFixed(1) }} МБ · карта и фото открываются без сети</span>
              <span v-else>карта и фото открываются без сети</span>
            </p>
            <p v-if="s.lastCleared.value" class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{{ s.lastCleared.value }}</p>
          </div>
          <button
            class="text-xs font-semibold px-3 py-2 rounded-xl bg-stone-200 dark:bg-white/10 dark:text-white active:scale-95 disabled:opacity-60"
            :disabled="s.clearing.value"
            @click="onClearCache"
          >
            {{ s.clearing.value ? '…' : 'Очистить' }}
          </button>
        </div>
      </div>
    </template>
  </Card>
</template>
