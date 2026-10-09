<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useAdminModules } from '@/composables/useAdminModules'
import { previewFor } from '@/composables/useModuleContent'
import { useAppModulesStore } from '@/stores/appModules'
import { computed, onMounted } from 'vue'

const mgr = useAdminModules()
const store = useAppModulesStore()

onMounted(() => {
  void mgr.load()
})

/**
 * Превью витрин из того же движка, что рисует лендинг и FAQ:
 * что именно увидят пользователи при текущем наборе.
 */
const preview = computed(() => previewFor(store.globalEnabled))
</script>

<template>
  <div class="rounded-3xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow-soft">
    <div class="flex items-center gap-2.5">
      <span class="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center text-white"><i class="pi pi-th-large" /></span>
      <div class="min-w-0 flex-1">
        <div class="text-base font-black text-stone-900 dark:text-white">Модули приложения · глобально</div>
        <div class="text-xs text-stone-500 dark:text-zinc-400">По умолчанию только ULove. Включайте остальные отдельными патчами — после этого пользователи увидят их тумблеры в настройках.</div>
      </div>
      <Button icon="pi pi-refresh" rounded outlined size="small" aria-label="Обновить" :loading="mgr.loading.value" @click="mgr.load()" />
    </div>

    <div class="mt-4 space-y-2">
      <div
        v-for="row in mgr.rows.value"
        :key="row.id"
        class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-3 py-2.5"
      >
        <i :class="[row.icon, 'text-base text-stone-500 dark:text-zinc-400 shrink-0']" />
        <div class="flex-1 text-sm min-w-0">
          <p class="font-semibold dark:text-white">{{ row.label }}<span v-if="row.locked" class="ml-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-300">всегда вкл</span></p>
          <p class="text-xs opacity-60 truncate">{{ row.desc }}</p>
        </div>
        <i v-if="mgr.saving.value === row.id" class="pi pi-spin pi-spinner text-sm text-stone-400 shrink-0" />
        <ToggleSwitch
          v-else
          :model-value="row.enabled"
          :disabled="row.locked"
          class="shrink-0"
          :aria-label="row.label"
          @update:model-value="mgr.toggle(row.id)"
        />
      </div>
    </div>

    <div class="mt-4 rounded-2xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 px-3 py-2.5">
      <p class="text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-zinc-500">Что увидят пользователи</p>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <Tag v-for="label in preview.tabs" :key="label" class="!rounded-full !text-[11px] !font-bold !border-0 !bg-gradient-to-r !from-rose-500 !to-orange-400 !text-white">Лендинг: {{ label }}</Tag>
        <Tag class="!rounded-full !text-[11px] !font-semibold !border-0 !bg-stone-200 dark:!bg-zinc-700 !text-stone-700 dark:!text-zinc-200">FAQ: +{{ preview.faqExtras }} ответов</Tag>
      </div>
      <p class="mt-1.5 text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">Лендинг, SEO, FAQ и бренд собираются из этого набора автоматически — руками ничего дописывать не нужно.</p>
    </div>

    <p class="mt-2 text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">Выключенный глобально раздел скрыт везде: меню, настройки пользователей, прямые URL и чанки. Пользовательские тумблеры появятся только после глобального включения.</p>
    <Message v-if="mgr.error.value" severity="error" :closable="false" class="mt-2">{{ mgr.error.value }}</Message>
  </div>
</template>
