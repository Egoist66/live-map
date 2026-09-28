<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useEmailVerification } from '@/composables/useEmailVerification'

/**
 * Карточка почты в разделе «Безопасность».
 *
 * Единственное место, где стафф тоже может подтвердить почту:
 * глобальная модалка для админов и модераторов не показывается.
 * Отправка ссылки — только по явной кнопке, с кулдауном.
 */
const verification = useEmailVerification()
</script>

<template>
  <Card
    class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft"
    :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }"
  >
    <template #content>
      <div class="max-w-xl">
        <h3 class="font-bold dark:text-white flex items-center gap-2">
          <i class="pi pi-envelope text-violet-600 dark:text-violet-400" />
          Почта для входа и уведомлений
        </h3>
        <p class="text-sm text-zinc-500 mt-1">
          {{ verification.email.value || '—' }}
        </p>
        <div class="mt-3">
          <Message v-if="verification.isVerified.value" severity="success" :closable="false" class="!rounded-2xl">
            <span class="flex items-center gap-2 text-sm font-bold">
              <i class="pi pi-verified" /> Почта подтверждена
            </span>
          </Message>
          <div v-else class="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
            <p class="text-sm font-bold text-amber-800 dark:text-amber-200">
              Почта не подтверждена
            </p>
            <p class="mt-1 text-[13px] leading-snug text-amber-700 dark:text-amber-300">
              Нажмите кнопку — пришлём ссылку. Без подтверждения выключены лайки в свайпах и сообщения.
            </p>
            <p v-if="verification.sent.value" class="mt-1 text-[13px] font-bold text-emerald-600 dark:text-emerald-300">
              Письмо отправлено — проверьте inbox и спам.
            </p>
            <p v-if="verification.error.value" class="mt-1 text-[13px] font-bold text-rose-600 dark:text-rose-300">
              {{ verification.error.value }}
            </p>
            <Button
              :label="verification.cooldownLeft.value > 0 ? `Ждите ${verification.cooldownLeft.value} сек.` : 'Подтвердить почту'"
              icon="pi pi-send"
              rounded
              size="small"
              :loading="verification.resending.value"
              :disabled="!verification.canResend.value"
              class="mt-3 !bg-ink-900 !border-ink-900 dark:!bg-white dark:!border-white dark:!text-ink-900"
              @click="verification.resend()"
            />
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
