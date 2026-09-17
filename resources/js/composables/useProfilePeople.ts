import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'

/**
 * Друзья профиля: модалка списка с infinite scroll.
 *
 * Публичный список пагинирован бэком (`meta.has_more`),
 * счётчик в шапке — из `meta.total` без лишних запросов.
 *
 * @example
 * const people = useProfilePeople()
 * await people.openFriends(12, 'Анна')
 * // <InfiniteSentinel :sentinel="..." :has-more="people.friendsHasMore" :loading="people.friendsLoadingMore" />
 */
export function useProfilePeople() {
  const friendsOpen = ref(false)
  const friendsTitle = ref('')
  const friends = ref<any[]>([])
  const friendsLoading = ref(false)
  const friendsLoadingMore = ref(false)
  const friendsHasMore = ref(true)
  const friendsPage = ref(1)
  const friendsLastPage = ref(1)
  const friendsUserId = ref<number | null>(null)
  const friendsCount = ref<number | null>(null)

  /**
   * Открыть модалку друзей и загрузить первую страницу.
   *
   * @param userId id профиля
   * @param name имя для заголовка
   */
  async function openFriends(userId: number, name?: string) {
    friendsTitle.value = name || ''
    friends.value = []
    friendsUserId.value = userId
    friendsOpen.value = true
    friendsLoading.value = true
    friendsHasMore.value = true
    try {
      const data = await chatApi.publicFriends(userId, 1, 20)
      friends.value = Array.isArray(data?.friends) ? data.friends : []
      const meta = (data as { meta?: { current_page: number; last_page: number; has_more: boolean; total: number } })?.meta
      friendsPage.value = meta?.current_page ?? 1
      friendsLastPage.value = meta?.last_page ?? 1
      friendsHasMore.value = meta ? !!meta.has_more : false
      if (typeof meta?.total === 'number') friendsCount.value = meta.total
    } catch {
      friends.value = []
      friendsHasMore.value = false
    } finally {
      friendsLoading.value = false
    }
  }

  /**
   * Догрузить следующую страницу друзей для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreFriends(): Promise<boolean> {
    const userId = friendsUserId.value
    if (!userId || friendsLoading.value || friendsLoadingMore.value || !friendsHasMore.value) return false
    friendsLoadingMore.value = true
    try {
      const next = friendsPage.value + 1
      const data = await chatApi.publicFriends(userId, next, 20)
      const rows = Array.isArray(data?.friends) ? data.friends : []
      const known = new Set(friends.value.map((f: { id?: number }) => f?.id))
      const fresh = rows.filter((f: { id?: number }) => !known.has(f?.id))
      friends.value = [...friends.value, ...fresh]
      const meta = (data as { meta?: { current_page: number; last_page: number; has_more: boolean } })?.meta
      friendsPage.value = meta?.current_page ?? next
      friendsLastPage.value = meta?.last_page ?? friendsPage.value
      friendsHasMore.value = meta ? !!meta.has_more : rows.length > 0
      return fresh.length > 0
    } catch {
      return false
    } finally {
      friendsLoadingMore.value = false
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
      const data = await chatApi.publicFriends(userId, 1, 1)
      const meta = (data as { meta?: { total: number } })?.meta
      if (typeof meta?.total === 'number') {
        friendsCount.value = meta.total
        return
      }
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
    friendsLoadingMore,
    friendsHasMore,
    friendsCount,
    openFriends,
    loadMoreFriends,
    closeFriends,
    loadFriendsCount,
    goProfile,
  }
}
