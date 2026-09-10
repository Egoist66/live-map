import { computed, ref } from 'vue'

export function useChatFilters(chat: any, friendsApi: any, blocksApi: any) {
  const chatFilter = ref('')
  const showPeopleSearch = ref(false)
  const q = computed(() => chatFilter.value.trim().toLowerCase())
  const match = (name?: string) => !q.value || (name || '').toLowerCase().includes(q.value)
  const filteredConversations = computed(() => (chat.conversations.value || []).filter((c: any) => c && match(c.other?.name)))
  const filteredFriends = computed(() => (friendsApi.friends.value || []).filter((f: any) => f && match(f.other?.name)))
  const filteredPendingIn = computed(() => (friendsApi.pendingIn.value || []).filter((r: any) => r && match(r.requester?.name)))
  const filteredBlocked = computed(() => (blocksApi.blocked.value || []).filter((b: any) => b && match(b.blocked?.name)))
  function clearFilter() { chatFilter.value = '' }
  return { chatFilter, showPeopleSearch, filteredConversations, filteredFriends, filteredPendingIn, filteredBlocked, clearFilter }
}
