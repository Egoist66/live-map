import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

/**
 * Друзья и заявки с бесконечной подгрузкой.
 *
 * Список друзей пагинирован бэком (`friends_meta.has_more`),
 * заявки — короткий топ-50 без скролла. Дедуп по id дружбы.
 *
 * @example
 * const f = useFriendships()
 * await f.load()
 * // <InfiniteSentinel :sentinel="..." :has-more="f.hasMore" :loading="f.loadingMore" />
 */
export function useFriendships() {
  const friends = ref<any[]>([])
  const pendingIn = ref<any[]>([])
  const pendingOut = ref<any[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const lastPage = ref(1)
  const error = ref<string|null>(null)

  /**
   * Загрузить первую страницу друзей + заявки.
   */
  async function load(){
    loading.value=true
    error.value=null
    hasMore.value = true
    try{
      const d=await chatApi.friendships(1, 20)
      friends.value=Array.isArray(d.friends) ? d.friends.filter(Boolean) : []
      pendingIn.value=Array.isArray(d.pending_in) ? d.pending_in.filter(Boolean) : []
      pendingOut.value=Array.isArray(d.pending_out) ? d.pending_out.filter(Boolean) : []
      const meta = (d as { friends_meta?: { current_page: number; last_page: number; has_more: boolean } }).friends_meta
      page.value = meta?.current_page ?? 1
      lastPage.value = meta?.last_page ?? 1
      hasMore.value = meta ? !!meta.has_more : false
    } catch(e:any){ error.value=e?.response?.data?.message||'Ошибка' } finally { loading.value=false }
  }

  /**
   * Догрузить следующую страницу друзей для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMore(): Promise<boolean> {
    if (loading.value || loadingMore.value || !hasMore.value) return false
    loadingMore.value = true
    try {
      const next = page.value + 1
      const d = await chatApi.friendships(next, 20)
      const rows = Array.isArray(d.friends) ? d.friends.filter(Boolean) : []
      const known = new Set(friends.value.map((f) => f?.id))
      const fresh = rows.filter((f) => !known.has(f?.id))
      friends.value = [...friends.value, ...fresh]
      const meta = (d as { friends_meta?: { current_page: number; last_page: number; has_more: boolean } }).friends_meta
      page.value = meta?.current_page ?? next
      lastPage.value = meta?.last_page ?? page.value
      hasMore.value = meta ? !!meta.has_more : rows.length > 0
      return fresh.length > 0
    } catch { return false } finally { loadingMore.value = false }
  }

  async function add(userId:number){
    await chatApi.addFriend(userId)
    await load()
  }
  async function accept(id:number){
    const idx = pendingIn.value.findIndex(r=> r?.id===id)
    const backup = idx!==-1 ? pendingIn.value[idx] : null
    if (backup) {
      pendingIn.value = pendingIn.value.filter(r=> r?.id!==id)
      friends.value = [...friends.value, { id: Date.now(), other: backup.requester }]
    }
    try { await chatApi.accept(id); await load() } catch(e){ if(backup) await load(); throw e }
  }
  async function decline(id:number){
    const backup = [...pendingIn.value]
    pendingIn.value = pendingIn.value.filter(r=> r?.id!==id)
    try { await chatApi.decline(id); await load() } catch(e){ pendingIn.value = backup; throw e }
  }
  async function remove(id:number){
    const backup = [...friends.value]
    friends.value = friends.value.filter(f=> f?.id!==id)
    try { await chatApi.removeFriend(id); await load() } catch(e){ friends.value = backup; throw e }
  }
  async function status(userId:number){ return chatApi.status(userId) }

  return { friends, pendingIn, pendingOut, loading, loadingMore, hasMore, error, load, loadMore, add, accept, decline, remove, status }
}
