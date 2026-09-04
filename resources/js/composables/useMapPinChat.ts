import { watch } from 'vue'
import { usePinChat } from '@/composables/usePinChat'

export function useMapPinChat(selectedPin: any) {
  const pinChat = usePinChat()
  watch(() => (selectedPin as any)?.value?.user?.id, (id) => {
    if (id && !(selectedPin as any).value.is_owner) pinChat.loadStatus(id)
  })
  return { pinChat }
}
