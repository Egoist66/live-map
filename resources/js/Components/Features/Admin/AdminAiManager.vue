<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Button from 'primevue/button'
import { useAdminAi } from '@/composables/useAdminAi'
import { onMounted } from 'vue'

const ai = useAdminAi()

onMounted(() => {
  void ai.load()
})
</script>

<template>
  <div class="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-[#0F121F] p-4 sm:p-6 shadow-soft">
    <div class="flex items-center gap-2.5">
      <span class="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 grid place-items-center text-white"><i class="pi pi-sparkles" /></span>
      <div class="min-w-0 flex-1">
        <div class="text-xs text-stone-500 dark:text-zinc-400">Выключен по умолчанию. Включи — пользователи увидят гида, AI-анкету и разбор профиля.</div>
      </div>
      <Button icon="pi pi-refresh" rounded outlined size="small" aria-label="Обновить" :loading="ai.loading.value" @click="ai.load()" />
    </div>

    <div class="mt-4 flex items-center gap-3 rounded-2xl border border-violet-200/70 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-500/5 px-3 py-2.5">
      <i class="pi pi-android text-base text-violet-500 shrink-0" />
      <div class="flex-1 text-sm min-w-0">
        <p class="font-semibold dark:text-white">Весь ИИ: гид + генерация анкет + разбор профиля</p>
        <p class="text-xs opacity-60 truncate">Модерация текстов работает всегда — это невидимый слой безопасности</p>
      </div>
      <i v-if="ai.saving.value" class="pi pi-spin pi-spinner text-sm text-stone-400 shrink-0" />
      <ToggleSwitch
        v-else
        :model-value="ai.enabled.value"
        class="shrink-0"
        aria-label="ИИ-функционал"
        @update:model-value="(v: boolean) => ai.setEnabled(v)"
      />
    </div>

    <p class="mt-2 text-xs text-stone-500 dark:text-zinc-400 leading-relaxed">Пока тумблер выключен — все ИИ-виджеты скрыты у всех, включая staff: ULove AI в панели, волшебная кнопка в профиле и диалог гида. Включили — видят все.</p>
    <Message v-if="ai.notice.value" severity="success" :closable="false" class="mt-2">{{ ai.notice.value }}</Message>
    <Message v-if="ai.error.value" severity="error" :closable="false" class="mt-2">{{ ai.error.value }}</Message>
  </div>
</template>
