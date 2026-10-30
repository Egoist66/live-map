<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

/**
 * Таб «Поддержка»: форма обращения пользователя.
 * Компонент только рисует, логика в `useSupportForm` (Правило №1).
 */
defineProps<{
  subject: string
  body: string
  sending: boolean
  sent: boolean
  sendError: string | null
  emailVerified?: boolean
  inboxOnly?: boolean
}>()
const emit = defineEmits<{ (e: 'update:subject', v: string): void; (e: 'update:body', v: string): void; (e: 'send'): void }>()
</script>
<template>
  <div class="min-w-0 space-y-4">
    <Card class="!bg-white dark:!bg-[#0F121F] !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0 min-w-0' } }">
      <template #content>
        <h3 class="break-words text-lg font-black tracking-tight dark:text-white">Обратиться в поддержку</h3>
        <p class="mt-1 break-words text-sm text-stone-500">Опиши проблему — ответим в течение часа.</p>
        <Message v-if="emailVerified === false" severity="warn" :closable="false" class="mt-3 !rounded-2xl !text-xs">
          Почта не подтверждена — ответ придёт только в приложение (колокольчик 🔔), а не письмом. Подтверди почту в профиле, чтобы получать ответы на email.
        </Message>
        <div class="mt-5 w-full min-w-0 max-w-xl space-y-3">
          <div class="min-w-0"><label class="text-sm font-medium">Тема</label><InputText :model-value="subject" @update:model-value="(v:any)=>emit('update:subject', v)" placeholder="Напр. Не грузится карта в Минске" maxlength="120" class="mt-1 w-full !rounded-2xl" /></div>
          <div class="min-w-0"><label class="text-sm font-medium">Сообщение</label><Textarea :model-value="body" @update:model-value="(v:any)=>emit('update:body', v)" rows="6" maxlength="2000" placeholder="Опиши проблему подробно..." class="mt-1 w-full !rounded-3xl" autoResize /></div>
          <Message v-if="sent && !inboxOnly" severity="success" :closable="false" class="!text-sm">Отправлено — ответим в течение часа на почту твоего аккаунта.</Message>
          <Message v-if="sent && inboxOnly" severity="info" :closable="false" class="!text-sm">Отправлено — ответ придёт в приложение (колокольчик 🔔), так как почта не подтверждена.</Message>
          <Message v-if="sendError" severity="error" :closable="false" class="!text-sm">{{ sendError }}</Message>
          <Button :loading="sending" :label="sending ? 'Отправляем…' : '✉️ Отправить обращение'" rounded class="w-full !bg-stone-900 !border-stone-900 !text-white" @click="emit('send')" />
        </div>
      </template>
    </Card>
  </div>
</template>
