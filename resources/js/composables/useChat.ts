import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { chatApi } from '@/services/chat.api'
import type { Conversation, ConversationDetail, Message } from '@/types/entities/Chat'

export function useChat() {
  const conversations = ref<Conversation[]>([])
  const activeConv = ref<ConversationDetail | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const typingUsers = ref<Set<number>>(new Set())
  const searchQuery = ref('')
  const searchResults = ref<any[]>([])
  const searching = ref(false)
  const selectedId = ref<number|null>(null)
  const error = ref<string|null>(null)
  let echoChannels: any[] = []
  let typingTimeout: any = null

  const unreadTotal = computed(()=> conversations.value.reduce((s,c)=>s+c.unread_count,0))

  async function loadConversations(){ conversations.value = await chatApi.conversations() }

  async function openConversation(id:number){
    selectedId.value=id
    loading.value=true
    try{
      const d=await chatApi.getConversation(id)
      activeConv.value=d
      messages.value=d.messages
      await chatApi.markRead(id)
      const conv=conversations.value.find(c=>c.id===id)
      if(conv) conv.unread_count=0
      subscribeChat(id)
      await nextTick()
      scrollToBottom()
    } finally { loading.value=false }
  }

  async function createConversation(userId:number, initialMessage?:string){
    error.value=null
    try{
      const res=await chatApi.createConversation(userId, initialMessage)
      await loadConversations()
      await openConversation(res.id)
      return res
    } catch(e:any){
      error.value=e?.response?.data?.message || e?.message || 'Не удалось создать чат'
      throw e
    }
  }

  async function sendMessage(body:string){
    if(!selectedId.value || !body.trim()) return
    sending.value=true
    try{
      const msg=await chatApi.sendMessage(selectedId.value, body.trim())
      messages.value.push(msg)
      const conv=conversations.value.find(c=>c.id===selectedId.value)
      if(conv){ conv.last_message=msg; conv.last_message_at=msg.created_at }
      scrollToBottom()
    } finally { sending.value=false }
  }

  function scrollToBottom(){
    nextTick(()=>{
      const el=document.getElementById('chat-messages')
      if(el) el.scrollTop=el.scrollHeight
    })
  }

  function handleIncoming(msg:Message){
    if(msg.conversation_id===selectedId.value){
      if(!messages.value.some(m=>m.id===msg.id)) messages.value.push(msg)
      chatApi.markRead(msg.conversation_id)
      scrollToBottom()
    } else {
      const conv=conversations.value.find(c=>c.id===msg.conversation_id)
      if(conv){ conv.unread_count=(conv.unread_count||0)+1; conv.last_message=msg }
      else loadConversations()
    }
  }

  function subscribeGlobal(){
    try{
      // @ts-ignore
      const echo=(window as any).Echo
      if(!echo) return
      const uid=(window as any).userId || document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if(uid){
        const ch=echo.private(`user.${uid}`)
        ch.listen('.message.sent',(e:any)=> handleIncoming(e.message))
        ch.listen('.friendship.updated',()=>{})
        echoChannels.push(ch)
      }
    }catch{}
  }

  function subscribeChat(convId:number){
    try{
      // @ts-ignore
      const echo=(window as any).Echo
      if(!echo) return
      echoChannels.forEach((c:any)=>{ try{c.stopListening('.message.sent');}catch{}})
      const ch=echo.private(`chat.${convId}`)
      ch.listen('.message.sent',(e:any)=> handleIncoming(e.message))
      ch.listen('.typing',(e:any)=>{
        if(e.is_typing) typingUsers.value.add(e.user_id)
        else typingUsers.value.delete(e.user_id)
      })
      ch.listen('.message.read',(e:any)=>{
        if(e.user_id!==selectedId.value) typingUsers.value.delete(e.user_id)
      })
      echoChannels.push(ch)
    }catch{}
  }

  async function searchUsers(){
    if(searchQuery.value.length<2){ searchResults.value=[]; return }
    searching.value=true
    try{ searchResults.value=await chatApi.search(searchQuery.value) } finally { searching.value=false }
  }

  function sendTyping(isTyping:boolean){
    if(!selectedId.value) return
    chatApi.typing(selectedId.value, isTyping)
  }

  function notifyTyping(){
    sendTyping(true)
    clearTimeout(typingTimeout)
    typingTimeout=setTimeout(()=>sendTyping(false),1500)
  }

  onMounted(()=>{ loadConversations(); subscribeGlobal() })
  onBeforeUnmount(()=>{ try{ // @ts-ignore
    const echo=(window as any).Echo; echoChannels.forEach(c=>echo.leave(c.name)) }catch{} })

  return {
    conversations, activeConv, messages, loading, sending, typingUsers,
    searchQuery, searchResults, searching, selectedId, error, unreadTotal,
    loadConversations, openConversation, createConversation, sendMessage, searchUsers, notifyTyping, handleIncoming
  }
}
