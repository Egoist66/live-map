<script setup lang="ts">
import Button from 'primevue/button'
import { useSosStore } from '@/stores/sos'

const emit = defineEmits<{ (e: 'chat', conversationId: number): void; (e: 'close'): void }>()

const sos = useSosStore()
</script>
<template>
  <div v-if="sos.active" class="pointer-events-auto w-fit max-w-[min(92vw,380px)] rounded-2xl border-2 border-red-400 dark:border-red-700 bg-red-600 text-white px-4 py-3 shadow-float">
    <div class="flex items-center gap-2">
      <span class="text-lg">🆘</span>
      <div class="min-w-0 flex-1">
        <div class="text-[13px] font-black leading-tight">Режим SOS{{ sos.isCreator ? ' · ваш вызов' : '' }}</div>
        <div class="text-[11px] text-white/85 truncate">{{ sos.active.pin?.title || 'Экстренный пин' }}</div>
      </div>
    </div>
    <div class="mt-1.5 text-[11px] leading-snug text-white/85">
      <span v-if="sos.active.status === 'pending'">Ожидание помощи — остальные пины скрыты.</span>
      <span v-else-if="sos.active.responder">Помогает: {{ sos.active.responder.name }} — остальные пины скрыты.</span>
    </div>
    <div class="mt-2 flex gap-2 flex-wrap">
      <Button v-if="sos.active.conversation_id" label="Открыть чат" icon="pi pi-comments" rounded size="small" class="!bg-white !text-red-700 !border-0 !font-bold" @click="emit('chat', sos.active.conversation_id)" />
      <Button v-if="sos.isCreator" label="Завершить SOS" icon="pi pi-check" rounded outlined size="small" class="!border-white !text-white" :loading="sos.acting" @click="emit('close')" />
    </div>
  </div>
</template>
