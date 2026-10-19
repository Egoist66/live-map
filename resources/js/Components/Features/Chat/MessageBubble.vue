<script setup lang="ts">
import { computed } from 'vue'
import Image from 'primevue/image'
import MessageTicks from '@/Components/Features/Feedback/MessageTicks.vue'
import VoiceMessagePlayer from '@/Components/Features/Chat/VoiceMessagePlayer.vue'
import SharedPostCard from '@/Components/Features/Chat/SharedPostCard.vue'
import { renderWithMentions } from '@/composables/useMentions'
import { useMentionNavigate } from '@/composables/useMentionNavigate'
import UserAvatar from '@/Components/Ui/Media/UserAvatar.vue'
import { formatDateTime } from '@/utils/date'

const props = defineProps<{ message: any; own: boolean; status: string; time: string; pinned?: boolean }>()
const emit = defineEmits<{ (e: 'edit', m: any): void; (e: 'delete', id: number): void; (e: 'pin', m: any): void; (e: 'reply', m: any): void; (e: 'jump', id: number): void }>()
const mentionNav = useMentionNavigate()

/**
 * Автор оригинала для подписи «Переслано от ...» с мелкой аватаркой.
 * Показываем только чужих авторов: своя пересылка себе пояснений не требует.
 */
const forwardedFrom = computed(() => {
  const from = (props.message as any)?.forwarded_from ?? null

  if (!from || Number(from?.id) <= 0) {
    return null
  }

  if (Number(from?.id) === Number((props.message as any)?.sender_id)) {
    return null
  }

  return from
})

/**
 * Тултип статуса доставки с датой: «Прочитано 12 мая 2026, 14:32».
 */
const deliveryTitle = computed(() => {
  const readAt = String((props.message as any)?.read_at ?? '')

  if (readAt !== '') {
    return `Прочитано ${formatDateTime(readAt)}`
  }

  const deliveredAt = String((props.message as any)?.delivered_at ?? '')

  if (deliveredAt !== '') {
    return `Доставлено ${formatDateTime(deliveredAt)}`
  }

  return ''
})

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
const sharedPost = computed(() => (props.message as any)?.shared_post ?? null)
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
        <div :class="['rounded-[22px] px-3.5 py-2.5 lg:px-4 lg:py-2 text-[15px] lg:text-sm leading-[1.45] shadow-sm transition-all duration-300', own ? 'bg-pink-200 dark:bg-pink-950 text-pink-950 dark:text-pink-100 rounded-br-[6px]' : 'bg-[#F0F2F4] dark:bg-zinc-800 text-stone-900 dark:text-white rounded-bl-[6px]', (message as any).pending ? 'opacity-60 scale-[0.98]' : 'opacity-100 scale-100', (message as any).failed ? '!bg-red-500 !text-white' : '', (message as any).justSent ? 'ring-2 ring-pink-400/60 dark:ring-pink-400/40' : '']">
          <div v-if="(message as any).is_pinned || pinned" class="text-[11px] lg:text-[10px] font-bold mb-1 opacity-80">📌 Закреплено</div>
          <div v-if="forwardedFrom" class="flex items-center gap-1.5 mb-1.5 min-w-0">
            <UserAvatar :user="forwardedFrom" shape="circle" class="!w-5 !h-5 shrink-0 [&_img]:object-cover" />
            <span :class="own ? 'text-rose-700 dark:text-pink-200' : 'text-[#1786FF] dark:text-sky-400'" class="text-[11px] lg:text-[10px] font-bold truncate">Переслано от {{ forwardedFrom.name || 'пользователя' }}</span>
          </div>
          <button v-if="quote" type="button" @click="emit('jump', quote.id)" :class="own ? 'border-rose-400/70 bg-rose-950/[0.06] hover:bg-rose-950/10 dark:border-pink-400/40 dark:bg-black/20 dark:hover:bg-black/30' : 'border-[#1786FF] bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.07] dark:hover:bg-white/15'" class="w-full text-left border-l-[3px] rounded-r-lg rounded-l-sm px-2.5 py-1.5 mb-1.5 transition active:scale-[0.98] min-w-0">
            <span :class="own ? 'text-rose-700 dark:text-pink-200' : 'text-[#1786FF] dark:text-sky-400'" class="block text-[11px] lg:text-[10px] font-bold truncate">{{ quote.sender_name || 'Сообщение' }}</span>
            <span :class="own ? 'text-pink-950/70 dark:text-pink-100/70' : 'text-stone-500 dark:text-zinc-400'" class="block text-xs lg:text-[11px] truncate">{{ quoteSnippet || '…' }}</span>
          </button>
          <div v-if="sharedPost" class="mb-1.5 min-w-0">
            <SharedPostCard :post="sharedPost" :own="own" />
          </div>
          <div v-if="attachment?.url && attachment?.kind === 'image'" class="mb-1.5 min-w-0">
            <Image :src="attachment.url" :alt="attachment.name || 'Фото'" preview class="block rounded-xl overflow-hidden chat-image-preview" image-class="block w-full max-h-64 object-cover cursor-zoom-in" />
          </div>
          <div v-else-if="isVoice" class="mb-1 min-w-0">
            <VoiceMessagePlayer :src="attachment?.url" :duration="(attachment as any)?.duration" :own="own" />
          </div>
          <div v-else-if="attachment?.url" class="mb-1.5 min-w-0">
            <a :href="attachment.url" target="_blank" rel="noopener" download class="flex items-center gap-2.5 rounded-xl px-3 py-2 min-w-0" :class="own ? 'bg-black/[0.06] hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15' : 'bg-black/[0.04] dark:bg-white/10 hover:bg-black/[0.07] dark:hover:bg-white/15'">
              <i class="pi pi-file text-xl shrink-0"></i>
              <span class="min-w-0 flex-1">
                <span class="block text-xs font-bold truncate">{{ attachment.name || 'Файл' }}</span>
                <span v-if="attachmentSize" class="block text-[11px] opacity-70">{{ attachmentSize }}</span>
              </span>
              <i class="pi pi-download text-sm shrink-0"></i>
            </a>
          </div>
          <div v-if="message.body" class="whitespace-pre-wrap break-words overflow-wrap-anywhere [overflow-wrap:anywhere] min-w-0 msg-body" :class="own ? 'msg-own' : 'msg-peer'" v-html="renderWithMentions(message.body || '')" @click="mentionNav.onRichClick"></div>
          <div v-else-if="attachment?.url && !isVoice" class="text-xs opacity-70 truncate">{{ attachment.name || 'Файл' }}</div>
          <div :class="own ? 'text-pink-950/60 dark:text-pink-100/60' : 'text-stone-400 dark:text-zinc-500'" class="text-[11px] lg:text-[10px] mt-1 text-right flex items-center justify-end gap-1.5">
            <span :title="deliveryTitle || undefined">{{ time }}</span>
            <span v-if="(message as any).is_edited" class="opacity-70">· изм.</span>
            <span v-if="own && deliveryTitle" :title="deliveryTitle" class="inline-flex">
              <MessageTicks :status="status" is-own />
            </span>
            <MessageTicks v-else-if="own" :status="status" is-own />
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
