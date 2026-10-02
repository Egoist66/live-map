<script setup lang="ts">
import Avatar from 'primevue/avatar'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import MiniChatWindow from '@/Components/Features/Chat/MiniChatWindow.vue'
import MessageTicks from '@/Components/Features/Feedback/MessageTicks.vue'
import { useMiniChatDock } from '@/composables/useMiniChatDock'

const dock = useMiniChatDock()
const dockRef = dock.dockRef
</script>

<template>
  <div ref="dockRef" class="pointer-events-none fixed bottom-5 right-5 z-40 hidden items-end gap-3 lg:flex">
    <div class="pointer-events-auto flex items-end gap-3">
      <div
        v-for="win in dock.windows.value"
        :key="win.convId"
        class="dock-pop"
      >
        <MiniChatWindow :win="win" :my-id="dock.myId.value" />
      </div>
    </div>

    <div class="pointer-events-auto relative flex flex-col items-end gap-2">
      <div
        v-if="dock.isListOpen.value"
        class="flex h-[480px] w-[320px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div class="flex shrink-0 items-center gap-2 border-b border-stone-100 px-3 py-2.5 dark:border-zinc-800">
          <span class="flex-1 text-sm font-black text-ink-900 dark:text-white">Сообщения</span>
          <Button
            icon="pi pi-external-link"
            text
            rounded
            severity="secondary"
            class="!h-8 !w-8"
            aria-label="Открыть все чаты"
            title="Открыть все чаты"
            @click="dock.openAllChats()"
          />
          <Button
            icon="pi pi-times"
            text
            rounded
            severity="secondary"
            class="!h-8 !w-8"
            aria-label="Закрыть список"
            @click="dock.closeList()"
          />
        </div>

        <div class="shrink-0 border-b border-stone-100 px-3 py-2 dark:border-zinc-800">
          <div class="relative w-full">
            <i class="pi pi-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400" />
            <InputText
              :model-value="dock.searchQuery.value"
              placeholder="Поиск по чатам…"
              class="w-full !rounded-full !bg-stone-100 !pl-9 !text-sm dark:!bg-zinc-800"
              @update:model-value="(v: string | undefined) => dock.setQuery(v ?? '')"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto scroll-neat p-1.5">
          <div v-if="dock.isListLoading.value" class="grid h-full place-items-center">
            <ProgressSpinner style="width:28px;height:28px" :strokeWidth="6" />
          </div>
          <div v-else-if="!dock.chatRows.value.length" class="grid h-full place-items-center px-6 text-center text-xs text-stone-400">
            Чатов пока нет — найди человека в разделе Чаты
          </div>
          <template v-else>
            <button
              v-for="conv in dock.chatRows.value"
              :key="conv.id"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-stone-100 dark:hover:bg-zinc-800"
              @click="dock.openChat(conv.id)"
            >
              <span class="relative shrink-0">
                <span v-if="conv.title" class="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-700 to-purple-900 text-base text-white">🏘️</span>
                <Avatar v-else :image="dock.avatarFor(conv)" shape="circle" class="!h-10 !w-10 [&_img]:object-cover" />
                <span v-if="Number(conv.unread_count || 0) > 0" class="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                  {{ Number(conv.unread_count) > 9 ? '9+' : conv.unread_count }}
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-[13px] font-bold text-ink-900 dark:text-white">{{ dock.displayName(conv) }}</span>
                  <span class="shrink-0 text-[10px] text-stone-400">{{ dock.timeOf(conv.last_message_at) }}</span>
                </span>
                <span class="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500 dark:text-zinc-400"><MessageTicks v-if="dock.isOwnLast(conv)" :status="dock.lastMessageStatus(conv) ?? 'sent'" /><span class="truncate">{{ dock.previewOf(conv) }}</span></span>
              </span>
            </button>
          </template>
        </div>

        <button
          type="button"
          class="flex shrink-0 items-center justify-center gap-2 border-t border-stone-100 px-3 py-2.5 text-[13px] font-bold text-violet-700 transition-colors hover:bg-violet-50 dark:border-zinc-800 dark:text-violet-300 dark:hover:bg-violet-500/10"
          @click="dock.openAllChats()"
        >
          <i class="pi pi-comments text-sm" />
          Открыть все чаты
        </button>
      </div>

      <div class="relative">
        <Button
          icon="pi pi-comments"
          rounded
          aria-label="Быстрые сообщения"
          title="Быстрые сообщения"
          class="!h-14 !w-14 !bg-violet-600 !border-violet-600 shadow-soft hover:!bg-violet-700"
          @click="dock.toggleList()"
        />
        <Badge
          v-if="dock.unreadLabel.value"
          :value="dock.unreadLabel.value"
          severity="danger"
          class="absolute -right-1 -top-1 !min-w-6 !rounded-full"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dock-pop {
  animation: dock-pop 180ms ease-out;
}

@keyframes dock-pop {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
