import { computed } from 'vue'
import { formatRelative } from '@/utils/date'

export function useLastSeen(lastSeenAt: string | null | undefined, isOnline: boolean) {
  const text = computed(() => {
    if (isOnline) return 'в сети'
    if (!lastSeenAt) return 'был(а) давно'
    try {
      return `был(а) ${formatRelative(lastSeenAt)}`
    } catch {
      return 'офлайн'
    }
  })
  return { text }
}
