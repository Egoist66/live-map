<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

defineProps<{ subject: string; body: string; sending: boolean; sent: boolean; sendError: string | null }>()
const emit = defineEmits<{ (e: 'update:subject', v: string): void; (e: 'update:body', v: string): void; (e: 'send'): void }>()
</script>
<template>
  <div class="space-y-4">
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Обратиться в поддержку</h3>
        <p class="text-sm text-stone-500 mt-1">Опиши проблему — ответим в течение часа.</p>
        <div class="mt-5 max-w-xl space-y-3">
          <div><label class="text-sm font-medium">Тема</label><InputText :model-value="subject" @update:model-value="(v:any)=>emit('update:subject', v)" placeholder="Напр. Не грузится карта в Минске" maxlength="120" class="w-full mt-1 !rounded-2xl" /></div>
          <div><label class="text-sm font-medium">Сообщение</label><Textarea :model-value="body" @update:model-value="(v:any)=>emit('update:body', v)" rows="6" maxlength="2000" placeholder="Опиши проблему подробно..." class="w-full mt-1 !rounded-3xl" autoResize /></div>
          <Message v-if="sent" severity="success" :closable="false" class="!text-sm">Отправлено — ответим в течение часа на почту твоего аккаунта.</Message>
          <Message v-if="sendError" severity="error" :closable="false" class="!text-sm">{{ sendError }}</Message>
          <Button :loading="sending" :label="sending ? 'Отправляем…' : '✉️ Отправить обращение'" rounded class="w-full !bg-stone-900 !border-stone-900 !text-white" @click="emit('send')" />
        </div>
      </template>
    </Card>
  </div>
</template>
