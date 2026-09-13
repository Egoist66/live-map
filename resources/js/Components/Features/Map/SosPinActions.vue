<script setup lang="ts">
import { onMounted } from 'vue'
import Button from 'primevue/button'
import { useSosAction } from '@/composables/useSosAction'

const props = defineProps<{ pinId: number; isOwner: boolean; authId: number }>()
const emit = defineEmits<{ (e: 'chat', conversationId: number): void; (e: 'closed'): void }>()

const action = useSosAction(props.pinId)

onMounted(async () => {
  await action.load()
})

async function onAccept(): Promise<void> {
  await action.acceptAndChat()
}

async function onClose(): Promise<void> {
  emit('closed')
}
</script>
<template>
  <div v-if="action.call.value" class="rounded-2xl border-2 p-3" :class="action.call.value.status === 'active' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700' : 'border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700'">
    <div v-if="action.loading.value" class="text-xs text-stone-500">Загрузка SOS…</div>
    <template v-else>
      <div v-if="isOwner" class="space-y-2">
        <div class="text-[13px] font-black text-red-700 dark:text-red-300">🆘 SOS активен — вас видят все</div>
        <div v-if="action.call.value.status === 'active' && action.call.value.responder" class="text-xs text-stone-600 dark:text-zinc-300">Помогает: <b>{{ action.call.value.responder.name }}</b></div>
        <div v-else class="text-xs text-stone-600 dark:text-zinc-300">Ожидаем, кто откликнется рядом…</div>
        <div class="flex gap-2 flex-wrap">
          <Button v-if="action.call.value.conversation_id" label="Открыть чат" icon="pi pi-comments" rounded size="small" @click="emit('chat', action.call.value.conversation_id)" />
          <Button label="Завершить SOS" icon="pi pi-check" severity="danger" outlined rounded size="small" :loading="action.acting.value" @click="onClose" />
        </div>
      </div>
      <div v-else class="space-y-2">
        <div class="text-[13px] font-black text-red-700 dark:text-red-300">🆘 Человеку нужна срочная помощь!</div>
        <template v-if="action.call.value.status === 'pending' && !action.declined.value">
          <p class="text-xs text-stone-600 dark:text-zinc-300 leading-snug">Примите вызов — откроется отдельный чат с автором, а на карте останется только этот пин.</p>
          <div class="flex gap-2 flex-wrap">
            <Button label="Принять" icon="pi pi-shield" severity="danger" rounded size="small" :loading="action.acting.value" @click="onAccept" />
            <Button label="Отклонить" severity="secondary" outlined rounded size="small" :disabled="action.acting.value" @click="action.reject()" />
          </div>
        </template>
        <div v-else-if="action.declined.value && action.call.value.status === 'pending'" class="space-y-2">
          <p class="text-xs text-stone-500 dark:text-zinc-400">Вы отклонили этот SOS.</p>
          <Button label="Всё же помочь" icon="pi pi-shield" severity="danger" outlined rounded size="small" :loading="action.acting.value" @click="onAccept" />
        </div>
        <div v-else-if="action.call.value.status === 'active' && action.call.value.responder">
          <p v-if="Number(action.call.value.responder.id) === Number(authId)" class="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Вы помогаете. Общайтесь в отдельном чате.</p>
          <p v-else class="text-xs text-stone-600 dark:text-zinc-300">На помощь уже выехал(а): <b>{{ action.call.value.responder.name }}</b></p>
          <Button v-if="Number(action.call.value.responder.id) === Number(authId) && action.call.value.conversation_id" label="Открыть чат" icon="pi pi-comments" rounded size="small" @click="emit('chat', action.call.value.conversation_id as number)" />
        </div>
      </div>
      <p v-if="action.error.value" class="text-xs text-red-500">{{ action.error.value }}</p>
    </template>
  </div>
</template>
