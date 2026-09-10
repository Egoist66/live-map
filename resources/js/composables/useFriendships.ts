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

  return { friends, pendingIn, pendingOut, loading, error, load, add, accept, decline, remove, status }
}
