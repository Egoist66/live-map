<script setup lang="ts">
import { onMounted } from 'vue'
import Message from 'primevue/message'
import Button from 'primevue/button'
import { useEmailVerification } from '@/composables/useEmailVerification'

const verification = useEmailVerification()

onMounted(() => {
  verification.consumeVerifiedFlag()
  void verification.refresh()
})

defineExpose({ verification })
</script>

<template>
  <div v-if="verification.needsVerification.value" class="mx-auto w-full max-w-[1280px] px-4 sm:px-6 pt-3">
    <Message severity="warn" :closable="false" class="!rounded-2xl">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-2">
          <i class="pi pi-envelope mt-0.5 shrink-0" />
          <div class="min-w-0">
            <div class="font-bold">Подтверди почту{{ verification.email.value ? ` ${verification.email.value}` : '' }}</div>
            <div class="text-[13px] leading-snug opacity-90">
              Мы отправили ссылку для подтверждения. Без неё нельзя лайкать в свайпах и писать сообщения — доступны только лента и избранное.
            </div>
            <div v-if="verification.sent.value" class="mt-1 text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
              Письмо отправлено заново — проверь inbox и спам.
            </div>
            <div v-if="verification.error.value" class="mt-1 text-[13px] font-bold text-rose-600 dark:text-rose-300">
              {{ verification.error.value }}
            </div>
          </div>
        </div>
        <Button
          label="Отправить заново"
          icon="pi pi-refresh"
          rounded
          size="small"
          :loading="verification.resending.value"
          class="shrink-0"
          @click="verification.resend()"
        />
      </div>
    </Message>
  </div>
  <div v-else-if="verification.justVerified.value" class="mx-auto w-full max-w-[1280px] px-4 sm:px-6 pt-3">
    <Message severity="success" :closable="false" class="!rounded-2xl">
      <div class="flex items-center gap-2">
        <i class="pi pi-verified shrink-0" />
        <span class="font-bold">Почта подтверждена! Лайки и сообщения разблокированы.</span>
      </div>
    </Message>
  </div>
</template>
