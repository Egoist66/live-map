<script setup lang="ts">
import { toRef } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import MessageTicks from '@/Components/Features/Feedback/MessageTicks.vue'
import { useMiniChat, type MiniWindow } from '@/composables/useMiniChat'
import { useMiniChatWindow } from '@/composables/useMiniChatWindow'

const props = defineProps<{ win: MiniWindow; myId: number }>()

const mini = useMiniChat()
const { scrollBox, isOwn, statusOf, timeOf, sendCurrent } = useMiniChatWindow(props.win, toRef(props, 'myId'))
</script>

<template>
  <div class="flex h-[420px] w-[300px] flex-col overflow-hidden rounded-2xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-soft">
    <div class="flex shrink-0 items-center gap-2 border-b border-stone-100 dark:border-zinc-800 px-2.5 py-2">
      <Avatar :image="win.avatar || undefined" shape="circle" class="!w-8 !h-8 shrink-0" />
      <span class="min-w-0 flex-1 truncate text-[13px] font-bold text-ink-900 dark:text-white">{{ win.title }}</span>
      <Button icon="pi pi-external-link" text rounded severity="secondary" class="!w-7 !h-7 shrink-0" aria-label="Открыть в чате" title="Открыть в чате" @click="mini.goFull(win.convId)" />
      <Button icon="pi pi-times" text rounded severity="secondary" class="!w-7 !h-7 shrink-0" aria-label="Закрыть" @click="mini.closeWindow(win.convId)" />
    </div>

    <div ref="scrollBox" class="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
      <div v-if="win.loading" class="grid h-full place-items-center">
        <ProgressSpinner style="width:24px;height:24px" :strokeWidth="6" />
      </div>
      <template v-else>
        <div v-if="win.hasMore" class="mb-2 flex justify-center">
          <Button label="Загрузить ещё" link size="small" class="!text-[11px]" :loading="win.loadingMore" @click="mini.loadMore(win.convId)" />
        </div>
        <div v-if="!win.messages.length" class="grid h-full place-items-center text-xs text-stone-400">Пока пусто — напиши первым</div>
        <div v-for="m in win.messages" :key="m.id" :class="['mb-1.5 flex', isOwn(m.sender_id) ? 'justify-end' : 'justify-start']">
          <div
            :class="['max-w-[85%] rounded-2xl px-2.5 py-1.5 text-[13px] leading-snug break-words [overflow-wrap:anywhere]', isOwn(m.sender_id) ? 'rounded-br-md bg-violet-600 text-white' : 'rounded-bl-md bg-stone-100 dark:bg-zinc-800 text-stone-800 dark:text-zinc-100']"
          >
            <div>{{ m.body || '📎 Вложение — смотри в чате' }}</div>
            <div :class="['mt-0.5 flex items-center justify-end gap-1 text-[10px]', isOwn(m.sender_id) ? 'text-white/70' : 'text-stone-400']">
              <span>{{ timeOf(m.created_at) }}</span>
              <MessageTicks v-if="isOwn(m.sender_id)" :status="statusOf(m)" />
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="shrink-0 border-t border-stone-100 dark:border-zinc-800 p-1.5">
      <div v-if="win.error" class="px-1 pb-1 text-[11px] text-red-500">{{ win.error }}</div>
      <div class="flex items-center gap-1">
        <InputText
          v-model="win.draft"
          placeholder="Сообщение…"
          enterkeyhint="send"
          class="min-w-0 flex-1 !rounded-full !border-0 !bg-stone-100 !py-2 !text-[14px] dark:!bg-zinc-800"
          @keyup.enter="sendCurrent()"
        />
        <Button icon="pi pi-send" rounded :loading="win.sending" :disabled="!win.draft.trim()" class="!h-9 !w-9 shrink-0" aria-label="Отправить" @click="sendCurrent()" />
      </div>
    </div>
  </div>
</template>
