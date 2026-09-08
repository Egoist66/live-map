import { watch } from 'vue'
import type { Ref } from 'vue'
import { useBadgeStore } from '@/stores/badges'

export function useChatBadges(unreadTotal: Ref<number>, pendingIn: Ref<any[]>, unreadMessagesTotal?: Ref<number>) {
  const badge = useBadgeStore()
  watch(unreadTotal, (v) => badge.setUnread(v), { immediate: true })
  if (unreadMessagesTotal) watch(unreadMessagesTotal, (v) => badge.setUnreadMessages(v), { immediate: true })
  watch(() => pendingIn.value.length, (v) => badge.setPending(v), { immediate: true })
  return badge
}
