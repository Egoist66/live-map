<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import TurnstileWidget from '@/Components/Security/TurnstileWidget.vue'
import { useCooperation } from '@/composables/useCooperation'

const coop = useCooperation()

defineExpose({ show: coop.show, close: coop.close })
</script>

<template>
  <Dialog
    v-model:visible="coop.open.value"
    modal
    :draggable="false"
    header="Сотрудничество"
    :style="{ width: '420px', maxWidth: '94vw', maxHeight: '92dvh' }"
    :pt="{
      root: { class: '!rounded-3xl max-sm:!rounded-b-none !border-0 !bg-white dark:!bg-[#0F121F] shadow-2xl overflow-hidden' },
      header: { class: '!px-5 !pt-5 !pb-0 !border-0 !bg-transparent' },
      title: { class: '!font-black !text-[19px] !tracking-tight dark:!text-white' },
      content: { class: '!px-5 !py-4 !bg-transparent' },
    }"
    @hide="coop.close()"
  >
    <div v-if="coop.sentCompany.value === null">
      <div class="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 p-4 text-white shadow-lg shadow-rose-500/30">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20"><i class="pi pi-briefcase text-lg leading-none" /></span>
        <p class="text-[13px] font-medium leading-snug">Оставьте email бизнеса — напишем с почты администратора и обсудим детали.</p>
      </div>
      <form class="mt-4 space-y-3" @submit.prevent="coop.submit()">
        <div>
          <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Email бизнеса *</label>
          <InputText
            v-model="coop.email.value"
            type="email"
            placeholder="info@company.by"
            autocomplete="email"
            class="mt-1.5 w-full !rounded-2xl"
            :invalid="!coop.emailValid.value && coop.email.value !== ''"
            @keydown.enter.prevent="coop.submit()"
          />
        </div>
        <div>
          <label class="text-[13px] font-semibold text-ink-900 dark:text-zinc-100">Пара слов <span class="font-normal text-stone-400 dark:text-zinc-500">(необязательно)</span></label>
          <Textarea
            v-model="coop.message.value"
            rows="3"
            maxlength="1000"
            placeholder="Чем занимаетесь и что предлагаете?"
            class="mt-1.5 w-full !rounded-2xl"
          />
        </div>
        <Message v-if="coop.error.value" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ coop.error.value }}</Message>
        <input v-model="coop.trap.value.value" :name="coop.trap.fieldName" type="text" :class="coop.trap.hiddenClass" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <TurnstileWidget v-model:token="coop.captchaToken.value" />
        <Button
          type="submit"
          label="Отправить заявку →"
          :loading="coop.sending.value"
          :disabled="!coop.canSubmit.value"
          class="w-full !border-0 !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !py-3 !font-bold !text-white !rounded-full shadow-lg shadow-rose-500/30 disabled:!opacity-60"
        />
      </form>
    </div>
    <div v-else class="py-2 text-center">
      <span class="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 text-white shadow-lg shadow-rose-500/30"><i class="pi pi-check text-2xl leading-none" /></span>
      <div class="mt-4 text-xl font-black tracking-tight dark:text-white">Заявка отправлена!</div>
      <p class="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-stone-500 dark:text-zinc-400">
        <b class="text-ink-900 dark:text-white">{{ coop.sentCompany.value }}</b>, спасибо! Ответим с почты администратора.
      </p>
      <Button label="Отлично" rounded class="mt-5 !border-0 !bg-ink-900 dark:!bg-white dark:!text-ink-900 !px-8 !text-white" @click="coop.close()" />
    </div>
  </Dialog>
</template>
