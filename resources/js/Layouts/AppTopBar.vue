<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import ApplicationLogo from '@/Components/Brand/ApplicationLogo.vue'
import Toolbar from 'primevue/toolbar'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'

defineProps<{ user: any; avatarSrc: string; dashboardHref: string; badgeTotal: number; lockEnabled?: boolean }>()
const emit = defineEmits<{ (e: 'bell'): void; (e: 'menu', ev: Event): void; (e: 'drawer'): void; (e: 'lock'): void }>()
</script>
<template>
  <Toolbar class="!p-0 !border-0 !rounded-none !bg-transparent !min-h-[64px] !h-[64px]" :pt="{ root: { class: '!min-h-[64px] !h-[64px] !bg-transparent !border-0 !p-0' }, start: { class: 'flex items-center gap-8 h-[64px]' }, end: { class: 'flex items-center gap-2 h-[64px]' } }">
    <template #start>
      <div class="flex items-center gap-3 sm:gap-8 h-[64px] min-h-[64px] px-3 sm:px-6 max-w-[1280px] mx-auto w-full min-w-0">
        <Link :href="dashboardHref" class="shrink-0"><ApplicationLogo /></Link>
        <nav aria-label="Основная навигация" class="hidden lg:flex items-center gap-1 bg-stone-100/80 dark:bg-zinc-800 p-1 rounded-full border border-stone-200/60 dark:border-zinc-700">
          <Link :href="dashboardHref" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', route().current('dashboard') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">Профиль</Link>
          <Link :href="route('map')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', route().current('map') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">Карта</Link>
          <Link :href="route('chat')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition relative', route().current('chat') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">Чат</Link>
          <Link :href="route('faq')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', route().current('faq') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">FAQ</Link>
        </nav>
      </div>
    </template>
    <template #end>
      <div class="flex items-center gap-1.5 sm:gap-2 h-[64px] min-h-[64px] pr-3 sm:pr-6 shrink-0">
        <button v-if="lockEnabled" @click="emit('lock')" title="Заблокировать" class="w-10 h-10 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition">
          <i class="pi pi-lock text-stone-600 dark:text-zinc-300"></i>
        </button>
        <button @click="emit('bell')" class="relative w-10 h-10 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition">
          <i class="pi pi-bell text-stone-600 dark:text-zinc-300"></i>
          <span v-if="badgeTotal" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-zinc-900">{{ badgeTotal > 9 ? '9+' : badgeTotal }}</span>
          <span v-if="badgeTotal" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 animate-ping opacity-30"></span>
        </button>
        <Link href="/map" class="hidden sm:inline-flex items-center gap-2 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-ink-800 transition">+ Создать пин</Link>
        <Button @click="emit('menu', $event)" severity="secondary" outlined rounded class="hidden sm:inline-flex !p-1 !pl-2 !pr-3 !bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 shadow-soft">
          <Avatar :image="avatarSrc" shape="circle" size="normal" class="!w-7 !h-7" />
          <span class="text-sm font-semibold text-ink-900 dark:text-white max-w-[120px] truncate hidden sm:inline">{{ user?.name }}</span>
          <i class="pi pi-chevron-down text-xs text-stone-500" />
        </Button>
        <Button @click="emit('drawer')" severity="secondary" outlined rounded class="lg:!hidden !w-10 !h-10 !p-0 !bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 shadow-soft" icon="pi pi-bars" />
      </div>
    </template>
  </Toolbar>
</template>
