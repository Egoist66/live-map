import { computed, type Ref } from 'vue'

export type SearchUser = {
  id: number
  is_friend?: boolean
  is_pending?: boolean
  friendship_outgoing?: boolean | null
  [key: string]: any
}

export function useChatSearchUser(user: Ref<SearchUser> | SearchUser) {
  const get = () => (typeof (user as any)?.value !== 'undefined' ? (user as Ref<SearchUser>).value : (user as SearchUser))
  const isFriend = computed(() => !!get()?.is_friend)
  const isPending = computed(() => !!get()?.is_pending)
  const showAdd = computed(() => !isFriend.value && !isPending.value)
  const addTitle = computed(() => (isFriend.value ? 'Уже в друзьях' : isPending.value ? 'Заявка отправлена' : 'В друзья'))
  const addIcon = computed(() => (isFriend.value ? 'pi pi-check' : isPending.value ? 'pi pi-clock' : 'pi pi-user-plus'))
  return { isFriend, isPending, showAdd, addTitle, addIcon }
}

export function useChatSearchList() {
  const isFriend = (u: SearchUser) => !!u?.is_friend
  const isPending = (u: SearchUser) => !!u?.is_pending
  const showAdd = (u: SearchUser) => !isFriend(u) && !isPending(u)
  const addTitle = (u: SearchUser) => (isFriend(u) ? 'Уже в друзьях' : isPending(u) ? 'Заявка отправлена' : 'В друзья')
  return { isFriend, isPending, showAdd, addTitle }
}
