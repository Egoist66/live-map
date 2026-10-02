<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import { useMobileBottomNav } from '@/composables/useMobileBottomNav'

const { dashboardHref, isActive, isActivePath, navLinkClass, businessActiveClass, businessIdleClass, total, bellTotal, avatarSrc, showSystemItems, showProfileLink, navHidden, isBusiness, showMap, showLove, gridClass } = useMobileBottomNav()

const emit = defineEmits<{ (e: 'bell'): void; (e: 'menu', value: Event): void }>()
</script>

<template>
  <nav
    aria-label="Мобильная навигация"
    :aria-hidden="navHidden ? 'true' : undefined"
    class="mobile-bottom-nav pb-[var(--sab)] lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0F121F]/95 backdrop-blur-xl border-t border-stone-200 dark:border-white/10"
  >
    <div :class="gridClass">
      <Link
        v-if="isBusiness"
        href="/cabinet"
        :aria-current="isActivePath('/cabinet') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="isActivePath('/cabinet') ? businessActiveClass : businessIdleClass"
      >
        <svg class="w-6 h-6" :fill="isActivePath('/cabinet') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        <span class="text-[10px] font-bold leading-none" :class="isActivePath('/cabinet') ? 'opacity-100' : 'opacity-75'">Кабинет</span>
      </Link>
      <Link
        v-else-if="showProfileLink"
        :href="dashboardHref"
        :aria-current="isActive('dashboard') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="navLinkClass('dashboard')"
      >
        <svg class="w-6 h-6" :fill="isActive('dashboard') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        <span class="text-[10px] font-bold leading-none" :class="isActive('dashboard') ? 'opacity-100' : 'opacity-75'">Профиль</span>
      </Link>

      <Link
        v-if="showMap"
        :href="route('map')"
        :aria-current="isActive('map') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="navLinkClass('map')"
      >
        <svg class="w-6 h-6" :fill="isActive('map') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
        <span class="text-[10px] font-bold leading-none" :class="isActive('map') ? 'opacity-100' : 'opacity-75'">Карта</span>
      </Link>

      <Link
        :href="route('chat')"
        :aria-current="isActive('chat') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition relative min-h-[52px]"
        :class="navLinkClass('chat')"
      >
        <span class="relative">
          <svg class="w-6 h-6" :fill="isActive('chat') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <span v-if="total" class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center leading-none border-2 border-white dark:border-[#0F121F]">{{ total>9?'9+':total }}</span>
        </span>
        <span class="text-[10px] font-bold leading-none" :class="isActive('chat') ? 'opacity-100' : 'opacity-75'">Чат</span>
      </Link>

      <Link
        v-if="showLove"
        :href="route('swipes')"
        :aria-current="isActive('swipes') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="navLinkClass('swipes')"
      >
        <svg class="w-6 h-6" :fill="isActive('swipes') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span
          class="text-[10px] font-black leading-none"
          :class="isActive('swipes') ? 'text-[#F04D9F] dark:text-[#F04D9F] opacity-100' : 'opacity-75'"
        >ULove</span>
      </Link>

      <button
        v-if="showSystemItems && !isBusiness"
        type="button"
        aria-label="Уведомления"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px] text-stone-500 dark:text-zinc-400"
        @click="emit('bell')"
      >
        <span class="relative block w-6 h-6">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          <span v-if="bellTotal" class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center leading-none border-2 border-white dark:border-[#0F121F]">{{ bellTotal > 9 ? '9+' : bellTotal }}</span>
        </span>
        <span class="text-[10px] font-bold leading-none opacity-75 truncate max-w-full px-0.5" title="Уведомления">Уведомления</span>
      </button>

      <button
        v-if="showSystemItems && !isBusiness"
        type="button"
        aria-label="Меню профиля"
        aria-haspopup="menu"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="navLinkClass('dashboard')"
        @click="emit('menu', $event)"
      >
        <span class="relative block w-6 h-6">
          <Avatar :image="avatarSrc" shape="circle" class="!w-6 !h-6 block" />
        </span>
        <span class="text-[10px] font-bold leading-none opacity-75 truncate max-w-full px-0.5" title="Меню">Меню</span>
      </button>
    </div>
  </nav>
</template>
