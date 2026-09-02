import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'

export function useFriendships() {
  const friends = ref<any[]>([])
  const pendingIn = ref<any[]>([])
  const pendingOut = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string|null>(null)

  async function load(){
    loading.value=true
    error.value=null
    try{
      const d=await chatApi.friendships()
      friends.value=d.friends
      pendingIn.value=d.pending_in
      pendingOut.value=d.pending_out
    } catch(e:any){ error.value=e?.response?.data?.message||'Ошибка' } finally { loading.value=false }
  }

  async function add(userId:number){
    await chatApi.addFriend(userId)
    await load()
  }
  async function accept(id:number){ await chatApi.accept(id); await load() }
  async function decline(id:number){ await chatApi.decline(id); await load() }
  async function remove(id:number){ await chatApi.removeFriend(id); await load() }
  async function status(userId:number){ return chatApi.status(userId) }

  return { friends, pendingIn, pendingOut, loading, error, load, add, accept, decline, remove, status }
}
