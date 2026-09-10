import { computed } from 'vue'

export function resolveMessageStatus(m: any, isOwn: boolean) {
  if (!m) return 'sent'
  if ((m as any)?.pending) return 'sending'
  if ((m as any)?.failed) return 'failed'
  if (!isOwn) return 'sent'
  if (m?.read_at) return 'read'
  if (m?.delivered_at) return 'delivered'
  if (m?.status === 'read') return 'read'
  if (m?.status === 'delivered') return 'delivered'
  return 'sent'
}

export function useChatMessageStatus(isOwnMessage: (m: any) => boolean) {
  function messageStatus(m: any) {
    return resolveMessageStatus(m, isOwnMessage(m))
  }
  return { messageStatus, resolveMessageStatus }
}
