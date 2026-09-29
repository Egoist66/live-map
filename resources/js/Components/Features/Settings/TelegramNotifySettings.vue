<script setup lang="ts">
import { onMounted } from 'vue'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import ToggleSwitch from 'primevue/toggleswitch'
import { useTelegram } from '@/composables/useTelegram'
import { useTelegramNotifications } from '@/composables/useTelegramNotifications'

const tg = useTelegramNotifications()
const { openLink } = useTelegram()

onMounted(() => {
  void tg.loadTelegramNotify()
})

const rows = [
  { key: 'notify_messages', title: 'Новые сообщения', desc: 'Кто-то написал — бот пришлёт текст с кнопкой «Открыть чат»' },
  { key: 'notify_likes', title: 'Лайки анкеты', desc: 'Вас лайкнули в ULove (инкогнито остаётся анонимным)' },
  { key: 'notify_matches', title: 'Мэтчи', desc: 'Взаимность — бот позовёт в открытый чат' },
] as const
</script>

<template>
  <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
    <i class="pi pi-telegram text-lg text-sky-500 shrink-0" />
    <div class="flex-1 text-sm min-w-0">
      <p class="font-semibold dark:text-white">Уведомления в Telegram</p>
      <p class="text-xs opacity-60">Бот пишет в личку, когда приложение закрыто, — ничего не пропустите.</p>

      <div v-if="tg.loading.value" class="mt-3 flex items-center gap-2 text-xs opacity-70">
        <ProgressSpinner style="width: 18px; height: 18px" :strokeWidth="6" aria-label="Загрузка настроек Telegram" />
        <span>Проверяем привязку…</span>
      </div>

      <template v-else>
        <Message v-if="!tg.linked.value" severity="info" class="mt-3 !text-xs">
          Аккаунт ещё не привязан. Откройте приложение через кнопку бота в Telegram — привязка произойдёт сама, и сюда прилетят уведомления.
        </Message>

        <template v-else>
          <Message v-if="!tg.canNotify.value" severity="warn" class="mt-3 !text-xs">
            Бот пока не может вам писать — нажмите
            <button type="button" class="underline font-semibold" @click="openLink(tg.botLink.value)">Start у @{{ tg.botUsername.value }}</button>,
            затем вернитесь сюда.
          </Message>

          <div class="mt-3 space-y-2">
            <label
              v-for="row in rows"
              :key="row.key"
              class="flex items-center gap-3 rounded-xl bg-stone-50 dark:bg-zinc-800/60 px-3 py-2.5 cursor-pointer"
            >
              <span class="flex-1 min-w-0">
                <span class="block text-[13px] font-semibold dark:text-zinc-100">{{ row.title }}</span>
                <span class="block text-xs opacity-60">{{ row.desc }}</span>
              </span>
              <ToggleSwitch
                :modelValue="tg.prefs.value[row.key]"
                :disabled="tg.saving.value"
                class="shrink-0"
                @update:modelValue="(v: boolean) => tg.saveTelegramNotify({ [row.key]: v })"
              />
            </label>
          </div>

          <p v-if="tg.errorMessage.value" class="mt-2 text-xs text-red-500">{{ tg.errorMessage.value }}</p>
        </template>
      </template>
    </div>
  </div>
</template>
