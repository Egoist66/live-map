import { computed } from 'vue'

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'edited'

export function useMessageStatus(message: any, isOwn: boolean) {
  const status = computed<MessageStatus>(() => {
    if (message.pending) return 'sending'
    if (message.failed) return 'failed'
    if (!isOwn) return 'sent'
    if (message.read_at) return 'read'
    if (message.delivered_at) return 'delivered'
    if (message.status === 'read') return 'read'
    if (message.status === 'delivered') return 'delivered'
    return 'sent'
  })
  const label = computed(() => {
    if (status.value === 'sending') return 'отправка...'
    if (status.value === 'failed') return 'ошибка'
    if (status.value === 'read') return 'прочитано'
    if (status.value === 'delivered') return 'доставлено'
    if (status.value === 'sent') return 'отправлено'
    return ''
  })
  return { status, label }
}
