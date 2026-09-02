<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { useChat } from '@/composables/useChat'
import { useFriendships } from '@/composables/useFriendships'
import { chatApi } from '@/services/chat.api'

const props = defineProps<{ conversationId?: number }>()
const { conversations, activeConv, messages, loading, sending, typingUsers, searchQuery, searchResults, searching, selectedId, unreadTotal, loadConversations, openConversation, createConversation, sendMessage, searchUsers, notifyTyping } = useChat()
const { friends, pendingIn, pendingOut, load: loadFriends, accept, decline } = useFriendships()
const input = ref('')
const tab = ref<'chats'|'friends'|'requests'>('chats')
const privacy = ref({ message_privacy: 'everyone', allow_random_messages: true })

async function handleSend(){
  if(!input.value.trim()) return
  const txt=input.value
  input.value=''
  await sendMessage(txt)
}

function formatTime(s:string){
  try{ return new Date(s).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) }catch{return s}
}

const creatingChat = ref(false)
async function startChatWith(u:any){
  if(u.can_message===false) return alert(u.can_message_reason || 'Пользователь не принимает сообщения')
  creatingChat.value=true
  try{
    await createConversation(u.id)
    tab.value='chats'
    searchQuery.value=''
    searchResults.value=[]
  } catch(e:any){
    alert(e?.response?.data?.message || e?.message || 'Ошибка создания чата')
  } finally { creatingChat.value=false }
}

async function savePrivacy(){
  await chatApi.updatePrivacy(privacy.value as any)
}

onMounted(async()=>{
  await loadFriends()
  try{ const me=await chatApi.me(); privacy.value.message_privacy=me.message_privacy; privacy.value.allow_random_messages=me.allow_random_messages }catch{}
  if(props.conversationId) openConversation(props.conversationId)
})

watch(searchQuery, ()=> searchUsers())
</script>

<template>
<AuthenticatedLayout>
<div class="mx-auto max-w-[1280px] px-4 sm:px-6 py-6">
  <div class="flex gap-4 h-[calc(100vh-140px)]">
    <div class="w-[360px] shrink-0 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 flex flex-col overflow-hidden">
      <div class="p-3 border-b dark:border-zinc-800">
        <div class="flex gap-1 bg-stone-100 dark:bg-zinc-800 p-1 rounded-full">
          <button @click="tab='chats'" :class="tab==='chats'?'bg-white dark:bg-zinc-700 shadow':''" class="flex-1 py-1.5 rounded-full text-xs font-semibold">Чаты <span v-if="unreadTotal" class="ml-1 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{{ unreadTotal }}</span></button>
          <button @click="tab='friends'" :class="tab==='friends'?'bg-white dark:bg-zinc-700 shadow':''" class="flex-1 py-1.5 rounded-full text-xs font-semibold">Друзья</button>
          <button @click="tab='requests'" :class="tab==='requests'?'bg-white dark:bg-zinc-700 shadow':''" class="flex-1 py-1.5 rounded-full text-xs font-semibold">Заявки <span v-if="pendingIn.length" class="ml-1 bg-amber-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{{ pendingIn.length }}</span></button>
        </div>
        <div class="mt-3 relative">
          <input v-model="searchQuery" placeholder="Поиск людей..." class="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <span class="absolute left-3 top-2.5 text-stone-400">⌕</span>
        </div>
        <div v-if="searchResults.length" class="mt-2 max-h-48 overflow-auto divide-y dark:divide-zinc-800 border rounded-xl">
          <div v-for="u in searchResults" :key="u.id" class="flex items-center justify-between p-2 hover:bg-stone-50 dark:hover:bg-zinc-800">
            <a :href="`/users/${u.id}`" class="flex items-center gap-2 hover:opacity-80">
              <img :src="u.avatar_path?`/storage/${u.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0F172A&color=fff`" class="w-8 h-8 rounded-full object-cover" />
              <div><div class="text-sm font-medium dark:text-white hover:underline">{{ u.name }}</div><div class="text-xs" :class="u.can_message?'text-emerald-600':'text-red-500'" :title="u.can_message_reason||''">{{ u.can_message?'можно написать':'не принимает' }}</div></div>
            </a>
            <button @click="startChatWith(u)" :disabled="u.can_message===false || creatingChat" :title="u.can_message===false ? (u.can_message_reason || 'Пользователь ограничил сообщения. Добавьте в друзья') : 'Начать диалог — откроется чат'" class="text-xs px-3 py-1 rounded-full bg-ink-900 dark:bg-white dark:text-zinc-900 text-white disabled:opacity-40 disabled:cursor-not-allowed">{{ creatingChat?'...' : 'Написать' }}</button>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-auto">
        <div v-if="tab==='chats'" class="divide-y dark:divide-zinc-800">
          <div v-if="!conversations.length" class="p-8 text-center text-sm text-stone-500">Нет чатов. Найдите человека выше ↑</div>
          <button v-for="c in conversations" :key="c.id" @click="openConversation(c.id)" :class="selectedId===c.id?'bg-violet-50 dark:bg-zinc-800':''" class="w-full flex items-center gap-3 p-3 hover:bg-stone-50 dark:hover:bg-zinc-800 text-left">
            <img :src="c.other?.avatar_path?`/storage/${c.other.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(c.other?.name||'?')}&background=0F172A&color=fff`" class="w-10 h-10 rounded-full object-cover" />
            <div class="flex-1 min-w-0">
              <div class="flex justify-between"><span class="text-sm font-semibold dark:text-white truncate">{{ c.other?.name||'Чат' }}</span><span v-if="c.last_message_at" class="text-[11px] text-stone-400 shrink-0 ml-2">{{ formatTime(c.last_message_at) }}</span></div>
              <div class="text-xs text-stone-500 truncate">{{ c.last_message?.body||'Нет сообщений' }}</div>
            </div>
            <span v-if="c.unread_count" class="bg-violet-600 text-white text-xs px-2 py-0.5 rounded-full">{{ c.unread_count }}</span>
          </button>
        </div>

        <div v-if="tab==='friends'" class="divide-y dark:divide-zinc-800">
          <div v-if="!friends.length" class="p-8 text-center text-sm text-stone-500">Нет друзей</div>
          <div v-for="f in friends" :key="f.id" class="flex items-center justify-between p-3">
            <a :href="`/users/${f.other.id}`" class="flex items-center gap-2 hover:opacity-80">
              <img :src="f.other.avatar_path?`/storage/${f.other.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(f.other.name)}&background=0F172A&color=fff`" class="w-9 h-9 rounded-full" />
              <span class="text-sm font-medium dark:text-white hover:underline">{{ f.other.name }}</span>
            </a>
            <button @click="startChatWith(f.other)" class="text-xs px-3 py-1 rounded-full border">Чат</button>
          </div>
        </div>

        <div v-if="tab==='requests'" class="divide-y dark:divide-zinc-800">
          <div v-if="!pendingIn.length" class="p-8 text-center text-sm text-stone-500">Нет заявок</div>
          <div v-for="r in pendingIn" :key="r.id" class="flex items-center justify-between p-3">
            <a :href="`/users/${r.requester.id}`" class="flex items-center gap-2 hover:opacity-80">
              <img :src="r.requester.avatar_path?`/storage/${r.requester.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(r.requester.name)}&background=0F172A&color=fff`" class="w-9 h-9 rounded-full" />
              <span class="text-sm dark:text-white hover:underline">{{ r.requester.name }}</span>
            </a>
            <div class="flex gap-1">
              <button @click="accept(r.id)" class="text-xs px-3 py-1 rounded-full bg-green-600 text-white">Принять</button>
              <button @click="decline(r.id)" class="text-xs px-3 py-1 rounded-full border">Отклонить</button>
            </div>
          </div>
        </div>
      </div>

      <div class="p-3 border-t dark:border-zinc-800 bg-stone-50 dark:bg-zinc-800/50 space-y-2">
        <div class="flex items-center gap-1">
          <label class="text-xs font-semibold">Приватность</label>
          <span title="Как работает:&#10;• Все могут писать — любой пользователь может начать чат с вами&#10;• Только друзья — писать могут только те, кого вы добавили в друзья и они приняли&#10;• Никто — никто не может написать, даже друзья&#10;Чекбокс ниже дополнительно ограничивает 'Все могут писать'" class="w-4 h-4 rounded-full bg-stone-200 dark:bg-zinc-700 grid place-items-center text-[10px] cursor-help">?</span>
        </div>
        <select v-model="privacy.message_privacy" @change="savePrivacy" class="w-full text-xs rounded-lg border px-2 py-1.5 dark:bg-zinc-900">
          <option value="everyone" title="Любой зарегистрированный пользователь может написать вам первым сообщением">Все могут писать — любой может создать чат</option>
          <option value="friends" title="Только взаимные друзья могут писать. Остальным нужно сначала отправить заявку в друзья">Только друзья — только принятые друзья</option>
          <option value="none" title="Полностью закрытые ЛС. Никто не сможет начать новый диалог">Никто — сообщения закрыты</option>
        </select>
        <div class="text-[11px] text-stone-500 leading-snug">
          <span v-if="privacy.message_privacy==='everyone'">Сейчас: любой может написать.</span>
          <span v-else-if="privacy.message_privacy==='friends'">Сейчас: только друзья.</span>
          <span v-else>Сейчас: никто не может написать.</span>
        </div>
        <label class="flex items-center gap-2 text-xs p-2 rounded-lg border bg-white dark:bg-zinc-900" :title="privacy.message_privacy!=='everyone' ? 'Работает только когда выбрано «Все могут писать»' : 'Если выключить — даже при «Все могут писать» писать смогут только друзья'">
          <input type="checkbox" v-model="privacy.allow_random_messages" @change="savePrivacy" :disabled="privacy.message_privacy!=='everyone'" />
          <span :class="privacy.message_privacy!=='everyone'?'opacity-50':''">Разрешить рандомным писать</span>
          <span title="Когда включено — любой может написать. Когда выключено — рандомные люди должны сначала стать друзьями, даже если выше выбрано «Все»" class="w-4 h-4 rounded-full bg-stone-200 dark:bg-zinc-700 grid place-items-center text-[10px] cursor-help ml-auto">?</span>
        </label>
        <div class="text-[11px] text-stone-400">Подсказка: дружба = взаимное согласие. Заявка → Принять.</div>
      </div>
    </div>

    <div class="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 flex flex-col overflow-hidden">
      <div v-if="!selectedId" class="flex-1 grid place-items-center text-stone-400 text-sm">Выберите чат или найдите человека</div>
      <template v-else>
        <div class="px-4 py-3 border-b dark:border-zinc-800 flex items-center gap-3">
          <a :href="activeConv?.other ? `/users/${activeConv.other.id}` : '#'" class="flex items-center gap-3 hover:opacity-80">
            <img :src="activeConv?.other?.avatar_path?`/storage/${activeConv!.other!.avatar_path}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv?.other?.name||'?')}&background=0F172A&color=fff`" class="w-9 h-9 rounded-full" />
            <div><div class="text-sm font-semibold dark:text-white hover:underline">{{ activeConv?.other?.name }}</div><div v-if="typingUsers.size" class="text-xs text-violet-600">печатает...</div><div v-else class="text-xs text-stone-400">профиль →</div></div>
          </a>
        </div>
        <div id="chat-messages" class="flex-1 overflow-auto p-4 space-y-2 bg-stone-50/50 dark:bg-zinc-950/30">
          <div v-if="loading" class="text-center text-xs text-stone-400">Загрузка...</div>
          <div v-for="m in messages" :key="m.id" :class="m.sender_id===($page.props.auth.user.id) ? 'flex justify-end' : 'flex justify-start'">
            <div :class="m.sender_id===($page.props.auth.user.id) ? 'bg-violet-600 text-white' : 'bg-white dark:bg-zinc-800 dark:text-white border'" class="max-w-[68%] rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm">
              <div>{{ m.body }}</div>
              <div :class="m.sender_id===($page.props.auth.user.id) ? 'text-violet-100' : 'text-stone-400'" class="text-[10px] mt-1 text-right">{{ formatTime(m.created_at) }}</div>
            </div>
          </div>
        </div>
        <div class="p-3 border-t dark:border-zinc-800 flex gap-2">
          <input v-model="input" @input="notifyTyping" @keydown.enter.prevent="handleSend" placeholder="Сообщение..." class="flex-1 px-4 py-2.5 rounded-full border dark:border-zinc-700 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <button @click="handleSend" :disabled="sending || !input.trim()" class="px-6 py-2.5 rounded-full bg-ink-900 dark:bg-white dark:text-zinc-900 text-white text-sm font-semibold disabled:opacity-40">➤</button>
        </div>
      </template>
    </div>
  </div>
</div>
</AuthenticatedLayout>
</template>
