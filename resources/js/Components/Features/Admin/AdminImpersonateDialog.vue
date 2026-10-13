<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Checkbox from 'primevue/checkbox'
import Message from 'primevue/message'

defineProps<{ imp: any }>()
</script>
<template>
  <Dialog :visible="imp.open.value" @update:visible="(v:boolean)=>{ if(!v) imp.close() }" modal header="Войти в аккаунт пользователя?" :style="{ width: '520px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none overflow-hidden' } }">
    <div class="space-y-3">
      <div class="rounded-2xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/30 p-3 text-[13px] leading-relaxed text-stone-700 dark:text-zinc-200">
        <div class="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5"><i class="pi pi-exclamation-triangle text-sm" /> Внимание: это доступ к личным данным</div>
        <p class="mt-1.5">Тайна переписки и личных сообщений защищена <b>ст. 28 Конституции РБ</b>. Незаконный просмотр чужих диалогов подпадает под <b>ст. 203 УК РБ</b> (нарушение тайны переписки, до 2 лет), <b>ст. 349 УК РБ</b> (несанкционированный доступ) и <b>ст. 203-1 УК РБ</b> (действия с персональными данными).</p>
        <p class="mt-1.5">Мы действуем строго в соответствии с законом — вход допустим только <b>по решению или официальной просьбе соответствующих органов</b>, либо для устранения технической проблемы по обращению пользователя. Действие фиксируется в журнале.</p>
      </div>
      <div class="text-sm dark:text-white">Войти как <b>{{ imp.target.value?.name }}</b> ({{ imp.target.value?.email }})?</div>
      <Textarea v-model="imp.reason.value" placeholder="Основание: № обращения / решение органа / причина (мин. 10 символов)" rows="3" fluid autoResize class="!rounded-2xl !text-sm" />
      <label class="flex items-start gap-2.5 text-[13px] text-stone-600 dark:text-zinc-300 cursor-pointer">
        <Checkbox v-model="imp.confirmed.value" :binary="true" class="mt-0.5 shrink-0" />
        <span>Подтверждаю законное основание и понимаю ответственность по ст. 203, 349, 203-1 УК РБ</span>
      </label>
      <Message v-if="imp.error.value" severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ imp.error.value }}</Message>
    </div>
    <template #footer>
      <Button label="Отмена" text @click="imp.close()" :disabled="imp.loading.value" />
      <Button label="Войти в аккаунт" severity="danger" :loading="imp.loading.value" :disabled="!imp.canSubmit.value" @click="imp.submit()" />
    </template>
  </Dialog>
</template>
