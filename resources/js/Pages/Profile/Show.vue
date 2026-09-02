<script setup lang="ts">
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue'
import { Head, Link } from '@inertiajs/vue3'
import { computed, ref } from 'vue'
import { useUserProfile } from '@/composables/useUserProfile'

const props = defineProps<{ profileUser: any; isOwn: boolean; friendship: any; isFriend: boolean; isPending: boolean; canMessage: boolean; canMessageReason: string | null }>()
const avatarSrc = computed(() => props.profileUser.avatar_path ? `/storage/${props.profileUser.avatar_path}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(props.profileUser.name)}&background=0F172A&color=fff&bold=true`)
const profile = useUserProfile(props.profileUser.id)
const showAvatar = ref(false)
const levelLabel: Record<string,string> = { novice:'Новичок', local:'Местный', guide:'Гид района', explorer:'Исследователь', veteran:'Ветеран' }

const isFriend = ref(props.isFriend)
const isPending = ref(props.isPending)
const canMessage = ref(props.canMessage)
const reason = ref(props.canMessageReason)

async function onAdd() {
  await profile.addFriend()
  isFriend.value = profile.isFriend.value
  isPending.value = profile.isPending.value
  canMessage.value = profile.canMessage.value
  reason.value = profile.reason.value
}
async function onChat() { await profile.startChat() }
</script>

<template>
<Head :title="profileUser.name" />
<AuthenticatedLayout>
<div class="bg-surface dark:bg-[#090E1A] min-h-[calc(100vh-64px)]">
<div class="max-w-[860px] mx-auto px-4 sm:px-6 py-6 space-y-5">
  <div class="bg-ink-900 dark:bg-zinc-900 dark:border dark:border-zinc-800 text-white rounded-[24px] p-6 sm:p-8 relative overflow-hidden">
    <div class="absolute -right-16 -top-16 w-72 h-72 bg-gradient-to-br from-brand-500 to-accent-teal rounded-full blur-[60px] opacity-20"></div>
    <div class="relative flex flex-col sm:flex-row gap-6">
      <button @click="showAvatar=true" class="group relative w-28 h-28 rounded-[20px] overflow-hidden border-2 border-white/20 shrink-0 bg-white/10">
        <img :src="avatarSrc" class="w-full h-full object-cover group-hover:scale-105 transition" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-black tracking-tight">{{ profileUser.name }}</h1>
        <p class="text-white/60 text-sm mt-1">{{ levelLabel[profileUser.level] || profileUser.level || 'Новичок' }} · {{ profileUser.reputation_score||0 }} ★ · на сайте с {{ new Date(profileUser.created_at).toLocaleDateString('ru-RU') }}</p>
        <p v-if="profileUser.home_lat" class="text-white/40 text-xs mt-1">Дом: {{ Number(profileUser.home_lat).toFixed(4) }}, {{ Number(profileUser.home_lng).toFixed(4) }} · {{ profileUser.home_radius_km||2 }} км</p>
        <div v-if="!isOwn" class="mt-4 flex flex-wrap gap-2">
          <button @click="onChat" :disabled="!canMessage || profile.loading.value" :title="canMessage ? 'Открыть чат' : (reason||'Закрыто')" class="px-6 py-2.5 rounded-full bg-white text-ink-900 text-sm font-bold hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed">💬 {{ canMessage ? 'Написать' : 'Закрыто' }}</button>
          <button v-if="!isFriend && !isPending" @click="onAdd" :disabled="profile.loading.value" title="Отправить заявку в друзья" class="px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/15">＋ В друзья</button>
          <span v-else-if="isPending" class="px-6 py-2.5 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold">⏳ Заявка отправлена</span>
          <span v-else class="px-6 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-bold">✓ Друзья</span>
          <Link v-if="isOwn" :href="route('profile.edit')" class="px-6 py-2.5 rounded-full bg-white/10 border border-white/15 text-white text-sm font-bold">Настройки</Link>
        </div>
        <p v-if="!isOwn && !canMessage" class="mt-3 text-xs text-red-300 bg-red-900/30 border border-red-800 rounded-xl px-3 py-2">{{ reason }} — добавьте в друзья</p>
      </div>
    </div>
  </div>

  <div class="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-[20px] p-6 shadow-soft">
    <h3 class="font-black">Информация</h3>
    <div class="mt-4 space-y-3 text-sm">
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Имя</span><span class="font-semibold dark:text-white">{{ profileUser.name }}</span></div>
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Уровень</span><span class="font-semibold dark:text-white">{{ levelLabel[profileUser.level] || profileUser.level }}</span></div>
      <div class="flex justify-between py-2.5 border-b border-stone-100 dark:border-zinc-800"><span class="text-stone-500">Репутация</span><span class="font-semibold dark:text-white">{{ profileUser.reputation_score||0 }}</span></div>
      <div class="flex justify-between py-2.5"><span class="text-stone-500">Дата регистрации</span><span class="font-semibold dark:text-white">{{ new Date(profileUser.created_at).toLocaleDateString('ru-RU') }}</span></div>
    </div>
    <div class="mt-6 flex gap-2">
      <Link href="/map" class="flex-1 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full py-2.5 text-sm font-bold text-center">На карту →</Link>
      <Link href="/chat" class="flex-1 bg-white border border-stone-200 rounded-full py-2.5 text-sm font-bold text-center">Чаты</Link>
    </div>
  </div>

  <div v-if="showAvatar" @click="showAvatar=false" class="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out">
    <img :src="avatarSrc" class="max-w-full max-h-[85vh] rounded-2xl object-contain" />
  </div>
</div>
</div>
</AuthenticatedLayout>
</template>
