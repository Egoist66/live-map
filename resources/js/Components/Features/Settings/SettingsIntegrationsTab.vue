<script setup lang="ts">
import { onMounted } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useClipboard } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { useBotQr } from '@/composables/useBotQr'

/**
 * Раздел «Интеграции»: Telegram-бот — QR для быстрого перехода,
 * ссылка, копирование username и список возможностей бота.
 * Имя бота и ссылка — из useBotQr (Правило №1),
 * QR-картинка лежит в `public/images/bot_qr.png`, клик по ней
 * открывает бота (скан камерой — тоже).
 */
const tg = useBotQr()
const { copy } = useClipboard()
const toast = (() => {
  try {
    return useToast()
  } catch {
    return null as any
  }
})()
const qrFailed = tg.qrFailed

onMounted(() => {
  void tg.loadTelegramNotify()
})

/**
 * Скопировать @username бота в буфер обмена.
 */
async function copyBotName(): Promise<void> {
  const name = `@${tg.botUsername.value || 'U1ove_bot'}`
  try {
    await copy(name)
    toast?.add({ severity: 'success', summary: 'Скопировано', detail: name, life: 2500 })
  } catch {
    toast?.add({ severity: 'error', summary: 'Не скопировалось', detail: 'Выделите имя вручную', life: 3000 })
  }
}
</script>

<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">Интеграции</h3>
      <p class="text-sm text-stone-500 mt-1">Telegram-бот: уведомления, избранное и вход в один клик.</p>

      <div class="mt-6 flex flex-col sm:flex-row gap-5 max-w-xl">
        <div v-if="!qrFailed" class="shrink-0 mx-auto sm:mx-0">
          <button type="button" :title="'Открыть бота в Telegram'" class="block rounded-2xl transition active:scale-95 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-sky-500" @click="tg.openBot()">
            <img
              :src="tg.qrSrc"
              alt="QR-код Telegram-бота — наведи камеру или нажми, чтобы открыть бота"
              width="220"
              height="220"
              loading="lazy"
              class="w-[200px] h-[200px] sm:w-[220px] sm:h-[220px] rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white object-contain cursor-pointer"
              @error="tg.markQrFailed()"
              @load="tg.markQrLoaded()"
            />
          </button>
          <p class="mt-2 text-center text-sm font-bold text-sky-600 dark:text-sky-400">@{{ tg.botUsername.value || 'U1ove_bot' }}</p>
        </div>

        <div class="flex-1 min-w-0 space-y-3">
          <p class="text-sm text-stone-600 dark:text-zinc-300 leading-relaxed">Наведи камеру на QR — откроется бот. Или перейди по ссылке:</p>
          <a :href="tg.botLink.value" target="_blank" rel="noopener" class="block text-sm font-bold text-sky-600 dark:text-sky-400 hover:underline break-all">{{ tg.botLink.value }}</a>
          <div class="flex flex-wrap gap-2">
            <Button as="a" :href="tg.botLink.value" target="_blank" rel="noopener" label="Открыть бота" icon="pi pi-send" rounded size="small" />
            <Button label="Скопировать имя" icon="pi pi-copy" rounded outlined size="small" severity="secondary" @click="copyBotName" />
          </div>
          <ul class="space-y-1.5 text-[13px] text-stone-500 dark:text-zinc-400">
            <li class="flex gap-2"><i class="pi pi-bell text-xs mt-1 shrink-0" /><span>Уведомления: сообщения, лайки, мэтчи — настраиваются во вкладке «Уведомления»</span></li>
            <li class="flex gap-2"><i class="pi pi-star text-xs mt-1 shrink-0" /><span>Избранное всегда под рукой: команда /notes в боте</span></li>
            <li class="flex gap-2"><i class="pi pi-key text-xs mt-1 shrink-0" /><span>Вход без пароля: открой приложение кнопкой бота — войдёшь автоматически</span></li>
          </ul>
        </div>
      </div>

      <Message v-if="qrFailed" severity="info" :closable="false" class="mt-4 max-w-xl !text-xs">
        QR-картинка пока не загружена в проект — открой бота по ссылке выше.
      </Message>
    </template>
  </Card>
</template>
