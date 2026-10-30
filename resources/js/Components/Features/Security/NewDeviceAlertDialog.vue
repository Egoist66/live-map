<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useClientReady } from '@/composables/useClientReady'
import { useNewDeviceAlert } from '@/composables/useNewDeviceAlert'

const { isClientReady } = useClientReady()
const alert = useNewDeviceAlert()

/**
 * Короткая дата входа.
 *
 * @param iso ISO-дата или null
 * @returns локализованная строка
 */
function fmtSeen(iso: string | null): string {
  if (!iso) return 'только что'
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return 'только что'
  }
}

/**
 * Подпись канала входа по клиенту устройства.
 *
 * @param client web|telegram|native
 * @returns человеческая строка
 */
function clientLabel(client: string): string {
  if (client === 'telegram') return 'через Telegram Mini App'
  if (client === 'native') return 'через приложение'
  return 'через браузер'
}
</script>
<template>
  <Dialog
    v-if="isClientReady"
    :visible="alert.open.value"
    @update:visible="(v:boolean)=>{ if(!v) alert.close() }"
    modal
    :draggable="false"
    :closable="true"
    :style="{ width: '420px', maxWidth: '94vw' }"
    :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden dark:!bg-[#0F121F] dark:!border-white/10' }, header: { class: '!p-5 !pb-0 !border-0 dark:!bg-[#0F121F] dark:!text-white' }, content: { class: '!px-5 !py-4 dark:!bg-[#0F121F]' }, footer: { class: '!px-5 !pb-5 !pt-1 !border-0 dark:!bg-[#0F121F]' } }"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <span class="w-11 h-11 rounded-2xl bg-red-600 text-white grid place-items-center shrink-0"><i class="pi pi-lock text-lg" /></span>
        <div class="min-w-0">
          <div class="font-black dark:text-white leading-tight">Вход с нового устройства</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400">{{ fmtSeen(alert.device.value?.seen_at ?? null) }}</div>
        </div>
      </div>
    </template>
    <div class="rounded-2xl bg-stone-100 dark:bg-white/[0.06] px-4 py-3">
      <div class="text-[15px] font-bold dark:text-white">{{ alert.device.value?.label || 'Неизвестное устройство' }}</div>
      <div class="mt-1 space-y-0.5 text-xs text-stone-500 dark:text-zinc-400">
        <div v-if="alert.device.value?.ip">IP {{ alert.device.value.ip }}</div>
        <div v-if="alert.device.value?.city || alert.device.value?.country">{{ [alert.device.value?.city, alert.device.value?.country].filter(Boolean).join(', ') }}</div>
        <div>{{ clientLabel(alert.device.value?.client ?? 'web') }}</div>
      </div>
    </div>
    <p class="mt-3 text-[13px] leading-relaxed text-stone-600 dark:text-zinc-300">Если это были <b>вы</b> — подтвердите вход. Если нет — завершите сеанс: устройство мгновенно вылетит из аккаунта. Для вечного бана — «Заблокировать».</p>
    <Message v-if="alert.error.value" severity="error" :closable="false" class="!mt-3 !rounded-2xl !text-xs">{{ alert.error.value }}</Message>
    <template #footer>
      <div class="flex flex-col gap-2">
        <Button
          label="Это я, подтверждаю"
          icon="pi pi-check"
          rounded
          severity="success"
          :loading="alert.acting.value === 'trust'"
          :disabled="alert.acting.value !== null"
          class="w-full !font-bold"
          @click="alert.act('trust')"
        />
        <Button
          label="Завершить его сеанс"
          icon="pi pi-sign-out"
          rounded
          outlined
          severity="warn"
          :loading="alert.acting.value === 'terminate'"
          :disabled="alert.acting.value !== null"
          class="w-full !font-bold"
          @click="alert.act('terminate')"
        />
        <Button
          label="Заблокировать навсегда"
          icon="pi pi-ban"
          link
          severity="danger"
          size="small"
          :loading="alert.acting.value === 'block'"
          :disabled="alert.acting.value !== null"
          class="w-full !text-xs"
          @click="alert.act('block')"
        />
      </div>
    </template>
  </Dialog>
</template>
