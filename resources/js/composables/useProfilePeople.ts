import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'

export function useProfilePeople() {
  const friendsOpen = ref(false)
  const friendsTitle = ref('')
  const friends = ref<any[]>([])
  const friendsLoading = ref(false)

  async function openFriends(userId: number, name?: string) {
    friendsTitle.value = name || ''
    friends.value = []
    friendsOpen.value = true
    friendsLoading.value = true
    try {
      const data = await chatApi.publicFriends(userId)
      friends.value = Array.isArray(data?.friends) ? data.friends : []
    } catch {
      friends.value = []
    } finally {
      friendsLoading.value = false
    }
  }

  function closeFriends() {
    friendsOpen.value = false
  }

  function goProfile(id: number) {
    closeFriends()
    router.visit(`/users/${id}`)
  }

  return {
    friendsOpen,
    friendsTitle,
    friends,
    friendsLoading,
    openFriends,
    closeFriends,
    goProfile,
  }
}
