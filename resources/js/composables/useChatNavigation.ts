import { watch, onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'

export function useChatNavigation(selectedId: Ref<number | null>, openConversation: (id: number) => Promise<void>) {
  function syncUrl(id: number | null) {
    const path = id ? `/chat/${id}` : '/chat'
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
  }

  watch(selectedId, syncUrl)

  function onPopState() {
    const m = window.location.pathname.match(/\/chat\/(\d+)/)
    if (m) {
      const id = Number(m[1])
      if (id !== selectedId.value) openConversation(id)
    } else {
      selectedId.value = null
    }
  }

  onMounted(() => window.addEventListener('popstate', onPopState))
  onBeforeUnmount(() => window.removeEventListener('popstate', onPopState))

  function backToList(closeEmoji: () => void, cancelEdit: () => void, showChatMenu: Ref<boolean>) {
    selectedId.value = null
    closeEmoji()
    cancelEdit()
    showChatMenu.value = false
  }

  return { backToList }
}
