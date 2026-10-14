<script setup lang="ts">
import { onMounted } from 'vue'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import ToggleSwitch from 'primevue/toggleswitch'
import { useTelegram } from '@/composables/useTelegram'
import { useBotQr } from '@/composables/useBotQr'
import { useTelegramNotifications, type TelegramNotifyPrefs } from '@/composables/useTelegramNotifications'

const tg = useTelegramNotifications()
const qr = useBotQr()
const { openLink } = useTelegram()

onMounted(() => {
  void tg.loadTelegramNotify()
})

type PrefKey = keyof TelegramNotifyPrefs

interface NotifyRow {
  key: PrefKey
  title: string
  desc: string
}

const botRows: NotifyRow[] = [
  { key: 'notify_messages', title: 'Новые сообщения', desc: 'Сообщение бота с фото автора и кнопкой «Открыть чат»' },
  { key: 'notify_likes', title: 'Лайки анкеты', desc: 'Вас лайкнули в ULove (инкогнито остаётся анонимным)' },
  { key: 'notify_matches', title: 'Мэтчи', desc: 'Взаимность — бот позовёт в открытый чат' },
  { key: 'notify_comments', title: 'Комментарии', desc: 'Ответили на ваш пин, фото, пост или новость района' },
  { key: 'notify_invites', title: 'Приглашения и заявки', desc: 'Зовут в пин, район или друзья; приняли, одобрили' },
  { key: 'notify_reviews', title: 'Отзывы о тебе', desc: 'Кто-то оценил твою анкету звёздами' },
  { key: 'notify_news', title: 'Новости приложения', desc: 'Важное от команды ULove — приходит всем сразу, даже если приложение открыто' },
 ]

const emailRows: NotifyRow[] = [
  { key: 'email_messages', title: 'Новые сообщения', desc: 'Дубль на основную почту (только подтверждённая)' },
  { key: 'email_likes', title: 'Лайки анкеты', desc: 'Дубль на основную почту' },
  { key: 'email_matches', title: 'Мэтчи', desc: 'Дубль на основную почту' },
]

function save(key: PrefKey, value: boolean): void {
  void tg.saveTelegramNotify({ [key]: value })
}
</script>

<template>
  <div class="flex items-center gap-3 rounded-2xl border border-stone-200/70 dark:border-zinc-800 px-4 py-3">
    <i class="pi pi-telegram text-lg text-sky-500 shrink-0" />
    <div class="flex-1 text-sm min-w-0">
      <p class="font-semibold dark:text-white">Уведомления: бот, почта</p>
      <p class="text-xs opacity-60">Одно событие — одно сообщение бота. Каждый тип отключается отдельно. Колокольчик в приложении звенит всегда.</p>

      <div v-if="tg.loading.value" class="mt-3 flex items-center gap-2 text-xs opacity-70">
        <ProgressSpinner style="width: 18px; height: 18px" :strokeWidth="6" aria-label="Загрузка настроек Telegram" />
        <span>Проверяем привязку…</span>
      </div>

      <template v-else>
        <Message v-if="!tg.linked.value" severity="info" class="mt-3 !text-xs">
          <span class="block">Аккаунт ещё не привязан. Наведи камеру на QR — откроется бот, нажми в нём Start и вернись сюда: привязка произойдёт сама.</span>
          <span class="mt-2 flex items-center gap-3">
            <button
              v-if="!qr.qrFailed.value"
              type="button"
              :title="`Открыть бота @${qr.botUsername.value}`"
              class="shrink-0 rounded-xl transition active:scale-95 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-sky-500"
              @click="qr.openBot()"
            >
              <img
                :src="qr.qrSrc"
                alt="QR-код Telegram-бота — наведи камеру или нажми, чтобы открыть бота"
                width="132"
                height="132"
                loading="lazy"
                class="w-[120px] h-[120px] rounded-xl border border-stone-200 dark:border-zinc-700 bg-white object-contain cursor-pointer"
                @error="qr.markQrFailed()"
                @load="qr.markQrLoaded()"
              />
            </button>
            <span class="min-w-0">
              <span class="block font-bold text-sky-600 dark:text-sky-400">@{{ qr.botUsername.value }}</span>
              <button type="button" class="underline font-semibold" @click="openLink(qr.botLink.value)">Открыть бота без камеры</button>
            </span>
          </span>
        </Message>

        <template v-else>
          <Message v-if="!tg.canNotify.value" severity="warn" class="mt-3 !text-xs">
            <span class="block">Бот пока не может вам писать — наведи камеру на QR или нажми на него, затем нажми Start у @{{ qr.botUsername.value }} и вернись сюда.</span>
            <span class="mt-2 flex items-center gap-3">
              <button
                v-if="!qr.qrFailed.value"
                type="button"
                :title="`Открыть бота @${qr.botUsername.value}`"
                class="shrink-0 rounded-xl transition active:scale-95 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-sky-500"
                @click="qr.openBot()"
              >
                <img
                  :src="qr.qrSrc"
                  alt="QR-код Telegram-бота — наведи камеру или нажми, чтобы открыть бота"
                  width="132"
                  height="132"
                  loading="lazy"
                  class="w-[120px] h-[120px] rounded-xl border border-stone-200 dark:border-zinc-700 bg-white object-contain cursor-pointer"
                  @error="qr.markQrFailed()"
                  @load="qr.markQrLoaded()"
                />
              </button>
              <button type="button" class="underline font-semibold" @click="openLink(qr.botLink.value)">Start у @{{ qr.botUsername.value }}</button>
            </span>
          </Message>

          <p class="mt-3 text-xs font-bold uppercase tracking-wide opacity-60">💬 Бот — сообщения сюда</p>
          <div class="mt-2 space-y-2">
            <label
              v-for="row in botRows"
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
                @update:modelValue="(v: boolean) => save(row.key, v)"
              />
            </label>
          </div>

          <p class="mt-3 text-xs font-bold uppercase tracking-wide opacity-60">📧 Почта — дубли на основную</p>
          <div class="mt-2 space-y-2">
            <label
              v-for="row in emailRows"
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
                @update:modelValue="(v: boolean) => save(row.key, v)"
              />
            </label>
          </div>

          <p v-if="tg.errorMessage.value" class="mt-2 text-xs text-red-500">{{ tg.errorMessage.value }}</p>
        </template>
      </template>
    </div>
  </div>
</template>
