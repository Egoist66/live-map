import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'

export function useProfilePeople() {
  const friendsOpen = ref(false)
  const friendsTitle = ref('')
  const friends = ref<any[]>([])
  const friendsLoading = ref(false)
  const friendsCount = ref<number | null>(null)

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

  /**
   * Тихо подгружает число друзей для счётчика в шапке профиля.
   * @param userId id пользователя
   */
  async function loadFriendsCount(userId: number): Promise<void> {
    try {
      const data = await chatApi.publicFriends(userId)
      const list = Array.isArray(data?.friends) ? data.friends : []
      friendsCount.value = list.length
    } catch {
      friendsCount.value = null
    }
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
    friendsCount,
    openFriends,
    closeFriends,
    loadFriendsCount,
    goProfile,
  }
}
