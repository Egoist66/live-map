<script setup lang="ts">
import MessageTicks from '@/Components/Features/Feedback/MessageTicks.vue'
import { renderWithMentions } from '@/composables/useMentions'

defineProps<{ message: any; own: boolean; status: string; time: string; pinned?: boolean }>()
const emit = defineEmits<{ (e: 'edit', m: any): void; (e: 'delete', id: number): void; (e: 'pin', m: any): void }>()
</script>
<template>
  <div :class="own ? 'flex justify-end' : 'flex justify-start'" class="min-w-0 w-full max-w-full">
    <div class="flex items-end gap-1.5 sm:gap-2 max-w-[88%] sm:max-w-[72%] lg:max-w-[68%] group min-w-0" :class="own ? 'flex-row-reverse' : 'flex-row'">
      <div v-if="!(message as any).pending" class="hidden lg:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0 pb-1">
        <button @click="emit('pin', message)" class="w-8 h-8 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition" :title="(message as any).is_pinned || pinned ? 'Открепить' : 'Закрепить'">{{ (message as any).is_pinned || pinned ? '📌' : '📍' }}</button>
        <button v-if="own" @click="emit('edit', message)" class="w-8 h-8 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition" title="Редактировать">✎</button>
        <button v-if="own" @click="emit('delete', message.id)" class="w-8 h-8 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition" title="Удалить">🗑</button>
      </div>
      <div class="relative min-w-0 flex-1 select-none">
        <div :class="['rounded-[18px] lg:rounded-2xl px-3.5 py-2.5 lg:px-3 lg:py-2 text-[15px] lg:text-sm leading-[1.4] shadow-sm transition-all duration-300', own ? 'bg-violet-600 text-white rounded-br-[6px]' : 'bg-white dark:bg-zinc-800 dark:text-white border border-stone-200 dark:border-zinc-700 rounded-bl-[6px]', (message as any).pending ? 'opacity-60 scale-[0.98]' : 'opacity-100 scale-100', (message as any).failed ? '!bg-red-500' : '', (message as any).justSent ? 'ring-2 ring-violet-300' : '']">
          <div v-if="(message as any).is_pinned || pinned" class="text-[11px] lg:text-[10px] font-bold mb-1 opacity-80">📌 Закреплено</div>
          <div class="whitespace-pre-wrap break-words overflow-wrap-anywhere [overflow-wrap:anywhere] min-w-0 msg-body" v-html="renderWithMentions(message.body || '')"></div>
          <div :class="own ? 'text-violet-100' : 'text-stone-400'" class="text-[11px] lg:text-[10px] mt-1 text-right flex items-center justify-end gap-1.5">
            <span>{{ time }}</span>
            <span v-if="(message as any).is_edited" class="opacity-70">· изм.</span>
            <MessageTicks v-if="own" :status="status" />
          </div>
        </div>
        <div v-if="!(message as any).pending" class="lg:hidden flex justify-end gap-1.5 mt-1.5 opacity-60">
          <button @click="emit('pin', message)" class="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-sm flex items-center gap-1">{{ (message as any).is_pinned || pinned ? '📌 Открепить' : '📍 Закрепить' }}</button>
          <button v-if="own" @click="emit('edit', message)" class="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-sm flex items-center gap-1">✎ Редакт.</button>
          <button v-if="own" @click="emit('delete', message.id)" class="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-sm flex items-center gap-1 text-red-600">🗑 Удалить</button>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.msg-body :deep(.mention){font-weight:700;text-decoration:underline;text-underline-offset:2px}
</style>
