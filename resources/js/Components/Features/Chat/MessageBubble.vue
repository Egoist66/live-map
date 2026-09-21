<script setup lang="ts">
import { computed } from 'vue'
import Image from 'primevue/image'
import MessageTicks from '@/Components/Features/Feedback/MessageTicks.vue'
import VoiceMessagePlayer from '@/Components/Features/Chat/VoiceMessagePlayer.vue'
import { renderWithMentions } from '@/composables/useMentions'
import { useMentionNavigate } from '@/composables/useMentionNavigate'

const props = defineProps<{ message: any; own: boolean; status: string; time: string; pinned?: boolean }>()
const emit = defineEmits<{ (e: 'edit', m: any): void; (e: 'delete', id: number): void; (e: 'pin', m: any): void; (e: 'reply', m: any): void; (e: 'jump', id: number): void }>()
const mentionNav = useMentionNavigate()

const quote = computed(() => (props.message as any)?.reply_to ?? null)
const quoteSnippet = computed(() => {
  const q = quote.value as any
  const kind = String(q?.kind ?? '')
  if ((kind === 'voice' || kind === 'audio') && !String(q?.body ?? '').trim()) {
    const secs = Number(q?.duration ?? 0)
    return secs > 0 ? `🎤 Голосовое · ${secs} c` : '🎤 Голосовое'
  }
  const t = String(q?.body ?? '').replace(/\s+/g, ' ').trim()
  if (t) {
    return t.length > 90 ? `${t.slice(0, 90)}…` : t
  }
  return 'Файл'
})
const attachment = computed(() => (props.message as any)?.attachment ?? null)
const isVoice = computed(() => attachment.value?.kind === 'voice' || (props.message as any)?.type === 'voice')
const isSystem = computed(() => String((props.message as any)?.type ?? '') === 'system')
const attachmentSize = computed(() => {
  const s = Number(attachment.value?.size) || 0
  if (!s) {
    return ''
  }
  if (s < 1024) {
    return `${s} Б`
  }
  const kb = s / 1024
  if (kb < 1024) {
    return `${kb.toFixed(0)} КБ`
  }
  return `${(kb / 1024).toFixed(1)} МБ`
})
</script>
<template>
  <div v-if="isSystem" class="flex justify-center w-full max-w-full py-1">
    <div class="max-w-[92%] rounded-full bg-stone-200/70 dark:bg-zinc-800 px-3.5 py-1.5 text-center text-xs leading-snug text-stone-500 dark:text-zinc-300 shadow-sm">
      {{ (message as any)?.body }}<span class="opacity-70"> · {{ time }}</span>
    </div>
  </div>
  <div v-else :class="own ? 'flex justify-end' : 'flex justify-start'" class="min-w-0 w-full max-w-full">
    <div class="flex items-end gap-1.5 sm:gap-2 max-w-[88%] sm:max-w-[72%] lg:max-w-[68%] min-w-0" :class="own ? 'flex-row-reverse' : 'flex-row'">
      <div class="relative min-w-0 flex-1 select-none">
        <div :class="['rounded-[18px] lg:rounded-2xl px-3.5 py-2.5 lg:px-3 lg:py-2 text-[15px] lg:text-sm leading-[1.4] shadow-sm transition-all duration-300', own ? 'bg-violet-600 text-white rounded-br-[6px]' : 'bg-white dark:bg-zinc-800 dark:text-white border border-stone-200 dark:border-zinc-700 rounded-bl-[6px]', (message as any).pending ? 'opacity-60 scale-[0.98]' : 'opacity-100 scale-100', (message as any).failed ? '!bg-red-500' : '', (message as any).justSent ? 'ring-2 ring-violet-300' : '']">
          <div v-if="(message as any).is_pinned || pinned" class="text-[11px] lg:text-[10px] font-bold mb-1 opacity-80">📌 Закреплено</div>
          <button v-if="quote" type="button" @click="emit('jump', quote.id)" :class="own ? 'border-white/50 bg-black/10 hover:bg-black/15' : 'border-violet-500 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20'" class="w-full text-left border-l-[3px] rounded-r-lg rounded-l-sm px-2.5 py-1.5 mb-1.5 transition active:scale-[0.98] min-w-0">
            <span :class="own ? 'text-violet-100' : 'text-violet-600 dark:text-violet-300'" class="block text-[11px] lg:text-[10px] font-bold truncate">{{ quote.sender_name || 'Сообщение' }}</span>
            <span :class="own ? 'text-violet-50/90' : 'text-stone-500 dark:text-zinc-400'" class="block text-xs lg:text-[11px] truncate">{{ quoteSnippet || '…' }}</span>
          </button>
          <div v-if="attachment?.url && attachment?.kind === 'image'" class="mb-1.5 min-w-0">
            <Image :src="attachment.url" :alt="attachment.name || 'Фото'" preview class="block rounded-xl overflow-hidden chat-image-preview" image-class="block w-full max-h-64 object-cover cursor-zoom-in" />
          </div>
          <div v-else-if="isVoice" class="mb-1 min-w-0">
            <VoiceMessagePlayer :src="attachment?.url" :duration="(attachment as any)?.duration" :own="own" />
          </div>
          <div v-else-if="attachment?.url" class="mb-1.5 min-w-0">
            <a :href="attachment.url" target="_blank" rel="noopener" download class="flex items-center gap-2.5 rounded-xl px-3 py-2 min-w-0" :class="own ? 'bg-black/15 hover:bg-black/20' : 'bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20'">
              <i class="pi pi-file text-xl shrink-0"></i>
              <span class="min-w-0 flex-1">
                <span class="block text-xs font-bold truncate">{{ attachment.name || 'Файл' }}</span>
                <span v-if="attachmentSize" class="block text-[11px] opacity-70">{{ attachmentSize }}</span>
              </span>
              <i class="pi pi-download text-sm shrink-0"></i>
            </a>
          </div>
          <div v-if="message.body" class="whitespace-pre-wrap break-words overflow-wrap-anywhere [overflow-wrap:anywhere] min-w-0 msg-body" v-html="renderWithMentions(message.body || '')" @click="mentionNav.onRichClick"></div>
          <div v-else-if="attachment?.url && !isVoice" class="text-xs opacity-70 truncate">{{ attachment.name || 'Файл' }}</div>
          <div :class="own ? 'text-violet-100' : 'text-stone-400'" class="text-[11px] lg:text-[10px] mt-1 text-right flex items-center justify-end gap-1.5">
            <span>{{ time }}</span>
            <span v-if="(message as any).is_edited" class="opacity-70">· изм.</span>
            <MessageTicks v-if="own" :status="status" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.msg-body :deep(.mention){font-weight:700;text-decoration:underline;text-underline-offset:2px}
.msg-body :deep(.mention-link){cursor:pointer}
</style>
