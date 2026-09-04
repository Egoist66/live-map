<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { useBadgeStore } from '@/stores/badges'

const badge = useBadgeStore()
const page = usePage()
const user = computed(() => (page.props.auth as any)?.user)
const isAdmin = computed(() => user.value?.is_admin || user.value?.role === 'admin')
const dashboardHref = computed(() => {
  if (!user.value) return route('dashboard')
  const id = isAdmin.value ? 'admin' : String(user.value.id)
  return route('dashboard', { identifier: id })
})
const isActive = (name: string) => route().current(name)
</script>

<template>
  <nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-stone-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom)]">
    <div class="flex items-center justify-around px-1 pt-1.5 pb-1">
      <Link :href="dashboardHref" class="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl active:scale-95 transition" :class="isActive('dashboard') ? 'text-ink-900 dark:text-white' : 'text-stone-400'">
        <span class="relative">
          <svg class="w-6 h-6" :fill="isActive('dashboard') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        </span>
        <span class="text-[10px] font-semibold leading-none" :class="isActive('dashboard') ? 'opacity-100' : 'opacity-70'">Профиль</span>
      </Link>

      <Link :href="route('map')" class="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl active:scale-95 transition" :class="isActive('map') ? 'text-ink-900 dark:text-white' : 'text-stone-400'">
        <svg class="w-6 h-6" :fill="isActive('map') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
        <span class="text-[10px] font-semibold leading-none" :class="isActive('map') ? 'opacity-100' : 'opacity-70'">Карта</span>
      </Link>

      <Link href="/map" class="flex flex-col items-center -mt-3 active:scale-95 transition">
        <span class="w-14 h-14 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 grid place-items-center shadow-lg shadow-ink-900/20 border-4 border-white dark:border-zinc-900 text-xl font-light">+</span>
      </Link>

      <Link :href="route('chat')" class="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl active:scale-95 transition relative" :class="isActive('chat') ? 'text-ink-900 dark:text-white' : 'text-stone-400'">
        <span class="relative">
          <svg class="w-6 h-6" :fill="isActive('chat') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <span v-if="badge.total" class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center leading-none border-2 border-white dark:border-zinc-900">{{ badge.total>9?'9+':badge.total }}</span>
        </span>
        <span class="text-[10px] font-semibold leading-none" :class="isActive('chat') ? 'opacity-100' : 'opacity-70'">Чат</span>
      </Link>

      <Link :href="route('faq')" class="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl active:scale-95 transition" :class="isActive('faq') ? 'text-ink-900 dark:text-white' : 'text-stone-400'">
        <svg class="w-6 h-6" :fill="isActive('faq') ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
        <span class="text-[10px] font-semibold leading-none" :class="isActive('faq') ? 'opacity-100' : 'opacity-70'">FAQ</span>
      </Link>
    </div>
  </nav>
</template>
