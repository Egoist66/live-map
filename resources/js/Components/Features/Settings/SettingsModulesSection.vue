<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import { useAppModulesSettings } from '@/composables/useAppModulesSettings'

const m = useAppModulesSettings()
</script>

<template>
  <div class="rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
    <div class="flex items-center gap-3">
      <i class="pi pi-th-large text-lg text-fuchsia-500 shrink-0" />
      <div class="flex-1 text-sm min-w-0">
        <p class="font-semibold dark:text-white">Разделы приложения</p>
        <p class="text-xs opacity-60">Что видно в меню из выпущенных разделов. Новые разделы появляются здесь после включения администратором.</p>
      </div>
    </div>

    <div v-if="m.onlyUlove.value" class="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
      Сейчас доступен только ULove. Остальные разделы выйдут отдельными обновлениями — тумблеры появятся здесь автоматически.
    </div>

    <div v-if="m.legacy.value" class="mt-3 rounded-xl bg-stone-100 dark:bg-zinc-800 px-3 py-2 text-xs text-stone-600 dark:text-zinc-300">
      Включено всё, как раньше. Выключи лишнее — останешься в своём разделе без шума.
    </div>

    <div class="mt-3 space-y-2">
      <div
        v-for="row in m.rows.value"
        :key="row.id"
        class="flex items-center gap-3 rounded-xl border border-stone-200/60 dark:border-zinc-800 px-3 py-2.5"
      >
        <i :class="[row.icon, 'text-base text-stone-500 dark:text-zinc-400 shrink-0']" />
        <div class="flex-1 text-sm min-w-0">
          <p class="font-semibold dark:text-white">{{ row.label }}</p>
          <p class="text-xs opacity-60 truncate">{{ row.desc }}</p>
        </div>
        <i v-if="m.busy.value[row.id]" class="pi pi-spin pi-spinner text-sm text-stone-400 dark:text-zinc-500 shrink-0" />
        <button
          v-else-if="row.enabled"
          type="button"
          :aria-label="row.isPrimary ? 'Стартовый раздел' : 'Сделать стартовым'"
          :title="row.isPrimary ? 'Стартовый раздел' : 'Сделать стартовым'"
          :disabled="m.saving.value"
          class="grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-90 disabled:opacity-50"
          :class="row.isPrimary ? 'text-amber-500' : 'text-stone-300 hover:text-amber-400 dark:text-zinc-600 dark:hover:text-amber-400'"
          @click="m.makePrimary(row.id)"
        >
          <i :class="[row.isPrimary ? 'pi pi-star-fill' : 'pi pi-star', 'text-lg']" />
        </button>
        <ToggleSwitch
          :model-value="row.enabled"
          :disabled="m.busy.value[row.id]"
          class="shrink-0"
          :aria-label="row.label"
          @update:model-value="m.toggle(row.id)"
        />
      </div>
    </div>

    <p class="text-xs text-stone-500 dark:text-zinc-400 mt-2 leading-relaxed">★ — раздел после входа. Включение докачивает его сразу, выключение перезагружает приложение начисто.</p>
    <Message v-if="m.error.value" severity="error" :closable="false" class="mt-2">{{ m.error.value }}</Message>
  </div>
</template>
