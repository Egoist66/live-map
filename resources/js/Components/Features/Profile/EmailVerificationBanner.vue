<script setup lang="ts">
import { onMounted } from 'vue'
import Message from 'primevue/message'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useEmailVerification } from '@/composables/useEmailVerification'

const verification = useEmailVerification()

onMounted(() => {
  verification.consumeVerifiedFlag()
  void verification.refresh()
})

defineExpose({ verification })
</script>

<template>
  <div v-if="verification.justVerified.value" class="mx-auto w-full max-w-[1280px] px-4 sm:px-6 pt-3">
    <Message severity="success" :closable="false" class="!rounded-2xl">
      <div class="flex items-center gap-2">
        <i class="pi pi-verified shrink-0" />
        <span class="font-bold">Почта подтверждена! Лайки и сообщения разблокированы.</span>
      </div>
    </Message>
  </div>

  <Dialog
    :visible="verification.shouldShowModal.value"
    modal
    :draggable="false"
    :closable="false"
    :style="{ width: '430px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{
      root: { class: '!rounded-[28px] !border-0 overflow-hidden !bg-white dark:!bg-zinc-900 shadow-2xl' },
      header: { class: '!hidden' },
      content: { class: '!p-0' },
    }"
  >
    <div class="relative overflow-hidden px-6 pb-6 pt-8 text-center">
      <div class="pointer-events-none absolute -top-16 left-1/2 h-44 w-72 -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-rose-500/20 blur-2xl" aria-hidden="true" />
      <div class="relative mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30">
        <i class="pi pi-envelope text-2xl" />
      </div>
      <h3 class="relative mt-4 text-xl font-black tracking-tight text-stone-900 dark:text-white">
        Подтвердите почту
      </h3>
      <p v-if="verification.email.value" class="relative mt-1 truncate text-sm font-bold text-violet-600 dark:text-violet-300">
        {{ verification.email.value }}
      </p>
      <p class="relative mt-2 text-sm leading-relaxed text-stone-500 dark:text-zinc-400">
        Нажмите кнопку — пришлём ссылку для подтверждения.
        Без неё в свайпах доступны только лента и избранное, а сообщения закрыты.
      </p>
      <div class="relative mt-3 flex items-start gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2.5 text-left">
        <i class="pi pi-check-circle mt-0.5 shrink-0 text-sm text-emerald-600 dark:text-emerald-300" />
        <p class="text-xs leading-snug text-emerald-800 dark:text-emerald-200">
          С подтверждённой почтой открываются лайки и сообщения + приходят напоминания: тебя лайкнули, новый мэтч, новое сообщение.
        </p>
      </div>
      <p v-if="verification.sent.value" class="relative mt-3 text-[13px] font-bold text-emerald-600 dark:text-emerald-300">
        Письмо отправлено — проверьте inbox и спам, затем перейдите по ссылке.
      </p>
      <p v-if="verification.error.value" class="relative mt-3 text-[13px] font-bold text-rose-600 dark:text-rose-300">
        {{ verification.error.value }}
      </p>
      <Button
        :label="verification.sent.value ? 'Отправить ещё раз' : 'Подтвердить почту'"
        icon="pi pi-send"
        rounded
        :loading="verification.resending.value"
        :disabled="!verification.canResend.value"
        class="!mt-5 !w-full !bg-gradient-to-r !from-violet-600 !to-fuchsia-600 !border-0 !py-3 !font-bold shadow-lg shadow-violet-600/30 active:scale-[0.99]"
        @click="verification.resend()"
      />
      <p v-if="verification.cooldownLeft.value > 0" class="relative mt-2 text-xs text-stone-400 dark:text-zinc-500">
        Повторно можно через {{ verification.cooldownLeft.value }} сек.
      </p>
      <button
        type="button"
        class="relative mt-3 text-[13px] font-medium text-stone-400 dark:text-zinc-500 underline underline-offset-2 hover:text-stone-600 dark:hover:text-zinc-300"
        @click="verification.dismiss()"
      >
        Продолжить без подтверждения
      </button>
    </div>
  </Dialog>
</template>
