<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import ApplicationLogo from '@/Components/ApplicationLogo.vue';
import Dropdown from '@/Components/Dropdown.vue';
import DropdownLink from '@/Components/DropdownLink.vue';
import NavLink from '@/Components/NavLink.vue';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink.vue';
import { Link, usePage, router } from '@inertiajs/vue3';
import { useBadgeStore } from '@/stores/badges';
import { usePresence } from '@/composables/usePresence';
import MobileBottomNav from '@/Components/MobileBottomNav.vue';
import { avatarSrcFor } from '@/composables/useAvatar';
const badge = useBadgeStore()
const presence = usePresence()
onMounted(()=> { badge.init(); presence.connect() })
onBeforeUnmount(()=> presence.disconnect())
router.on('navigate', () => { presence.connect(); showingNavigationDropdown.value = false })
const showingNavigationDropdown = ref(false);
const page = usePage()
const avatarSrc = computed(() => avatarSrcFor(page.props.auth.user))
const dashboardHref = computed(() => {
  const u = page.props.auth.user
  if (!u) return route('dashboard')
  const id = u.is_admin || u.role === 'admin' ? 'admin' : String(u.id)
  return route('dashboard', { identifier: id })
})
const settingsHref = computed(() => {
  const u = page.props.auth.user
  if (!u) return route('profile.edit')
  const id = u.is_admin || u.role === 'admin' ? 'admin' : String(u.id)
  return route('profile.edit', { identifier: id })
})
</script>

<template>
  <div class="min-h-screen bg-surface dark:bg-[#0B0F1A] overflow-x-hidden">
    <nav class="sticky top-0 z-50 glass border-b border-stone-200/70 dark:border-zinc-800">
      <div class="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div class="flex h-[64px] justify-between items-center">
          <div class="flex items-center gap-8">
            <Link :href="dashboardHref" class="shrink-0">
              <ApplicationLogo />
            </Link>
            <div class="hidden lg:flex items-center gap-1 bg-stone-100/80 dark:bg-zinc-800 p-1 rounded-full border border-stone-200/60 dark:border-zinc-700">
              <NavLink :href="dashboardHref" :active="route().current('dashboard')" class="!border-0 !pt-0 !px-4 !py-1.5 !rounded-full text-[13px] font-semibold" :class="route().current('dashboard') ? '!bg-white dark:!bg-zinc-700 !shadow-soft !text-ink-900 dark:!text-white border border-stone-200' : '!text-stone-500 dark:!text-zinc-400 hover:!text-ink-900'">Профиль</NavLink>
              <NavLink :href="route('map')" :active="route().current('map')" class="!border-0 !pt-0 !px-4 !py-1.5 !rounded-full text-[13px] font-semibold" :class="route().current('map') ? '!bg-white dark:!bg-zinc-700 !shadow-soft !text-ink-900 dark:!text-white border border-stone-200' : '!text-stone-500 dark:!text-zinc-400 hover:!text-ink-900'">Карта</NavLink>
              <NavLink :href="route('chat')" :active="route().current('chat')" class="!border-0 !pt-0 !px-4 !py-1.5 !rounded-full text-[13px] font-semibold relative" :class="route().current('chat') ? '!bg-white dark:!bg-zinc-700 !shadow-soft !text-ink-900 dark:!text-white border border-stone-200' : '!text-stone-500 dark:!text-zinc-400 hover:!text-ink-900'">Чат
                <span v-if="badge.unread" class="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">{{ badge.unread>99?'99+':badge.unread }}</span>
                <span v-if="badge.pending" class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold leading-none">{{ badge.pending>99?'99+':badge.pending }}</span>
                <span v-if="badge.total" class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              </NavLink>
              <NavLink :href="route('faq')" :active="route().current('faq')" class="!border-0 !pt-0 !px-4 !py-1.5 !rounded-full text-[13px] font-semibold" :class="route().current('faq') ? '!bg-white dark:!bg-zinc-700 !shadow-soft !text-ink-900 dark:!text-white border border-stone-200' : '!text-stone-500 dark:!text-zinc-400 hover:!text-ink-900'">FAQ</NavLink>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Link href="/map" class="hidden sm:inline-flex items-center gap-2 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-ink-800 transition">+ Создать пин</Link>
            <div class="hidden sm:flex items-center">
              <Dropdown align="right" width="48">
                <template #trigger>
                    <button class="relative flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:shadow-card transition">
                    <span v-if="badge.total" class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-800 animate-pulse"></span>
                    <img :src="avatarSrc" class="w-7 h-7 rounded-full object-cover border dark:border-zinc-600" />
                    <span class="text-sm font-semibold text-ink-900 dark:text-white max-w-[120px] truncate">{{ $page.props.auth.user.name }}</span>
                    <span class="w-6 h-6 rounded-full bg-stone-100 dark:bg-zinc-700 grid place-items-center text-stone-500">
                      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                    </span>
                  </button>
                </template>
                <template #content>
                  <div class="py-2 dark:bg-zinc-900">
                    <div class="px-4 pb-3 mb-2 border-b border-stone-100 dark:border-zinc-800 flex gap-3">
                      <img :src="avatarSrc" class="w-9 h-9 rounded-full object-cover" />
                      <div class="min-w-0"><div class="text-sm font-semibold truncate dark:text-white">{{ $page.props.auth.user.name }}</div><div class="text-xs text-stone-500 truncate">{{ $page.props.auth.user.email }}</div></div>
                    </div>
                    <DropdownLink :href="dashboardHref" class="!text-sm flex items-center justify-between">Профиль <span v-if="badge.total" class="ml-2 inline-flex gap-1"><span v-if="badge.unread" class="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{{ badge.unread }}</span><span v-if="badge.pending" class="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{{ badge.pending }}</span></span></DropdownLink>
                    <DropdownLink :href="settingsHref" class="!text-sm">Настройки</DropdownLink>
                    <DropdownLink :href="route('map')" class="!text-sm">Карта</DropdownLink>
                    <DropdownLink :href="route('logout')" method="post" as="button" class="!text-sm">Выйти</DropdownLink>
                  </div>
                </template>
              </Dropdown>
            </div>

            <button @click="showingNavigationDropdown = !showingNavigationDropdown" class="lg:hidden w-10 h-10 shrink-0 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft relative z-10">
              <svg class="h-5 w-5 text-ink-900 dark:text-white" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path v-if="!showingNavigationDropdown" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-show="showingNavigationDropdown" class="lg:hidden border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl">
        <div class="px-4 py-3 space-y-1">
          <ResponsiveNavLink :href="dashboardHref" :active="route().current('dashboard')">Профиль</ResponsiveNavLink>
          <ResponsiveNavLink :href="route('map')" :active="route().current('map')">Карта</ResponsiveNavLink>
          <ResponsiveNavLink :href="route('chat')" :active="route().current('chat')" class="flex items-center justify-between">Чат <span class="flex gap-1"><span v-if="badge.unread" class="inline-flex min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold items-center justify-center">{{ badge.unread }}</span><span v-if="badge.pending" class="inline-flex min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold items-center justify-center">{{ badge.pending }}</span></span></ResponsiveNavLink>
          <ResponsiveNavLink :href="route('faq')" :active="route().current('faq')">FAQ</ResponsiveNavLink>
          <Link href="/map" class="mt-2 flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-4 py-2.5 text-sm font-semibold justify-center">+ Создать пин</Link>
        </div>
        <div class="border-t border-stone-200 dark:border-zinc-800 px-4 py-4">
          <div class="flex items-center gap-3">
            <img :src="avatarSrc" class="w-9 h-9 rounded-full object-cover" />
            <div><div class="text-sm font-semibold dark:text-white">{{ $page.props.auth.user.name }}</div><div class="text-xs text-stone-500">{{ $page.props.auth.user.email }}</div></div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <ResponsiveNavLink :href="settingsHref" class="!border !rounded-xl !px-3">Настройки</ResponsiveNavLink>
            <ResponsiveNavLink :href="dashboardHref" class="!border !rounded-xl !px-3">Профиль</ResponsiveNavLink>
            <ResponsiveNavLink :href="route('logout')" method="post" as="button" class="!border !rounded-xl !px-3">Выйти</ResponsiveNavLink>
          </div>
        </div>
      </div>
    </nav>

    <header v-if="$slots.header" class="bg-white dark:bg-zinc-900 border-b border-stone-200/60 dark:border-zinc-800">
      <div class="mx-auto max-w-[1280px] px-4 sm:px-6 py-6">
        <slot name="header" />
      </div>
    </header>

    <main :class="route().current('chat') || route().current('map') ? 'pb-0 lg:pb-0' : 'pb-[76px] lg:pb-0'"><slot /></main>
    <MobileBottomNav />
  </div>
</template>
