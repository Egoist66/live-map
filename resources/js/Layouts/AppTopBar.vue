<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import ApplicationLogo from '@/Components/Brand/ApplicationLogo.vue'
import Avatar from 'primevue/avatar'
import { useViewportBreakpoints } from '@/composables/useViewportBreakpoints'

defineProps<{ user: any; avatarSrc: string; dashboardHref: string; badgeTotal: number; lockEnabled?: boolean }>()
const emit = defineEmits<{ (e: 'bell'): void; (e: 'menu', ev: Event): void; (e: 'lock'): void }>()

const { isXxs } = useViewportBreakpoints()
</script>
<template>
  <div class="mx-auto flex h-14 w-full min-w-0 max-w-[1280px] items-center gap-1 px-2 min-[411px]:h-16 min-[411px]:gap-2 min-[411px]:px-3 sm:px-6">
    <Link :href="dashboardHref" class="min-w-0 shrink-0 rounded-xl active:scale-95 transition" aria-label="На главную">
      <ApplicationLogo :compact="isXxs" />
    </Link>

    <nav aria-label="Основная навигация" class="hidden lg:flex items-center gap-1 bg-stone-100/80 dark:bg-zinc-800 p-1 rounded-full border border-stone-200/60 dark:border-zinc-700 shrink-0">
      <Link :href="route('map')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', route().current('map') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">Карта</Link>
      <Link :href="route('chat')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition relative', route().current('chat') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">Чат</Link>
      <Link :href="route('swipes')" title="ULove" :class="['px-4 py-1.5 rounded-full transition inline-flex items-center', route().current('swipes') ? 'bg-white dark:bg-zinc-700 shadow-soft border border-stone-200' : 'hover:text-ink-900']"><span class="text-[13px] font-black tracking-tight leading-none bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 dark:from-rose-400 dark:via-fuchsia-400 dark:to-orange-300 bg-clip-text text-transparent">ULove</span></Link>
      <Link :href="route('flow')" title="UFlow" :class="['px-4 py-1.5 rounded-full transition inline-flex items-center', route().current('flow') ? 'bg-white dark:bg-zinc-700 shadow-soft border border-stone-200' : 'hover:text-ink-900']"><span class="text-[13px] font-black tracking-tight leading-none bg-gradient-to-r from-sky-500 via-blue-600 to-fuchsia-500 dark:from-sky-400 dark:via-blue-400 dark:to-fuchsia-400 bg-clip-text text-transparent">UFlow</span></Link>
    </nav>

    <span class="min-w-0 flex-1" />

    <div class="flex shrink-0 items-center gap-1 min-[411px]:gap-1.5 sm:gap-2">
      <button v-if="lockEnabled" @click="emit('lock')" title="Заблокировать" aria-label="Заблокировать" class="topbar-round-btn grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition active:scale-95 min-[411px]:h-10 min-[411px]:w-10">
        <i class="pi pi-lock text-stone-600 dark:text-zinc-300"></i>
      </button>
      <button @click="emit('bell')" aria-label="Уведомления" class="topbar-round-btn relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition active:scale-95 min-[411px]:h-10 min-[411px]:w-10">
        <i class="pi pi-bell text-sm text-stone-600 dark:text-zinc-300"></i>
        <span v-if="badgeTotal" class="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white dark:border-zinc-900 bg-red-500 px-1 text-[10px] font-bold text-white">{{ badgeTotal > 9 ? '9+' : badgeTotal }}</span>
        <span v-if="badgeTotal" class="absolute -top-1 -right-1 h-[18px] min-w-[18px] rounded-full bg-red-500 animate-ping opacity-30"></span>
      </button>
      <Link v-if="!route().current('map')" href="/map" class="hidden sm:inline-flex items-center gap-2 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-ink-800 transition whitespace-nowrap">+ Создать пин</Link>
      <button @click="emit('menu', $event)" aria-label="Меню профиля" class="grid h-10 w-10 !min-h-[40px] shrink-0 place-items-center overflow-hidden rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 sm:flex sm:h-11 sm:w-auto sm:items-center sm:gap-2 sm:px-3">
        <Avatar :image="avatarSrc" shape="circle" size="normal" class="!w-8 !h-8" />
        <span class="text-sm font-semibold text-ink-900 dark:text-white max-w-[120px] truncate hidden sm:inline">{{ user?.name }}</span>
      </button>
    </div>
  </div>
</template>
