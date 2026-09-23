<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { useMobileBottomNav } from '@/composables/useMobileBottomNav'

const { dashboardHref, isActive, isActivePath, navLinkClass, total, navHidden, isBusiness, showMap, showLove, showFlow, showDistricts, gridClass } = useMobileBottomNav()

const businessActiveClass = 'text-brand-600 dark:text-[#A5B4FC] bg-brand-50 dark:bg-brand-500/20'
const businessIdleClass = 'text-stone-500 dark:text-zinc-400'
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
        v-else
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
        v-if="showLove"
        :href="route('swipes')"
        :aria-current="isActive('swipes') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="navLinkClass('swipes')"
      >
        <svg class="w-6 h-6" :fill="isActive('swipes') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="7" y="4" width="10" height="16" rx="2.5"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.5 12H5m-2.5 0L4 10.5M2.5 12L4 13.5M21.5 12H19m2.5 0L20 10.5m1.5 1.5L20 13.5"/></svg>
        <span
          class="text-[10px] font-black leading-none"
          :class="isActive('swipes') ? 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 dark:from-rose-400 dark:via-fuchsia-400 dark:to-orange-300 bg-clip-text text-transparent opacity-100' : 'opacity-75'"
        >ULove</span>
      </Link>

      <Link
        v-if="showFlow"
        :href="route('flow')"
        :aria-current="isActive('flow') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="navLinkClass('flow')"
      >
        <svg class="w-6 h-6" :fill="isActive('flow') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6"/></svg>
        <span
          class="text-[10px] font-black leading-none"
          :class="isActive('flow') ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-fuchsia-500 dark:from-sky-400 dark:via-blue-400 dark:to-fuchsia-400 bg-clip-text text-transparent opacity-100' : 'opacity-75'"
        >UFlow</span>
      </Link>

      <Link
        v-if="showDistricts"
        :href="route('districts.index')"
        :aria-current="isActive('districts.index') ? 'page' : undefined"
        class="flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl active:scale-95 transition min-h-[52px]"
        :class="navLinkClass('districts.index')"
      >
        <svg class="w-6 h-6" :fill="isActive('districts.index') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="text-[10px] font-bold leading-none" :class="isActive('districts.index') ? 'opacity-100' : 'opacity-75'">Районы</span>
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
    </div>
  </nav>
</template>
