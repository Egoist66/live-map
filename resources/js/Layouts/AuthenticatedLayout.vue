<script setup lang="ts">
import AppTopBar from '@/Layouts/AppTopBar.vue'
import AppDrawerMenu from '@/Layouts/AppDrawerMenu.vue'
import AppUserMenu from '@/Layouts/AppUserMenu.vue'
import MobileBottomNav from '@/Components/Features/Navigation/MobileBottomNav.vue'
import PageTransition from '@/Components/Features/Feedback/PageTransition.vue'
import GlobalNotificationToasts from '@/Components/Features/Feedback/GlobalNotificationToasts.vue'
import BellNotificationsModal from '@/Components/Features/Feedback/BellNotificationsModal.vue'
import { useAppLayout } from '@/composables/useAppLayout'

const { badge, user, avatarSrc, dashboardHref, settingsHref, bell, showDrawer, menu, menuItems, toggleMenu, logout } = useAppLayout()
</script>
<template>
  <div class="min-h-screen bg-surface dark:bg-[#0B0F1A] overflow-x-hidden">
    <div class="sticky top-0 z-50 glass border-b border-stone-200/70 dark:border-zinc-800 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-900/70">
      <AppTopBar :user="user" :avatar-src="avatarSrc" :dashboard-href="dashboardHref" :badge-total="badge.total" @bell="bell.open()" @menu="toggleMenu" @drawer="showDrawer = true" />
    </div>
    <AppUserMenu v-model:menu-ref="menu" :user="user" :avatar-src="avatarSrc" :items="(menuItems as any)" />
    <AppDrawerMenu :open="showDrawer" @update:open="(v:boolean)=>showDrawer=v" :user="user" :avatar-src="avatarSrc" :dashboard-href="dashboardHref" :settings-href="settingsHref" @logout="logout" />
    <header v-if="$slots.header" class="bg-white dark:bg-zinc-900 border-b border-stone-200/60 dark:border-zinc-800">
      <div class="mx-auto max-w-[1280px] px-4 sm:px-6 py-6"><slot name="header" /></div>
    </header>
    <main :class="route().current('chat') || route().current('map') ? 'pb-0 lg:pb-0' : 'pb-[76px] lg:pb-0'">
      <PageTransition><slot /></PageTransition>
    </main>
    <MobileBottomNav />
    <GlobalNotificationToasts />
    <BellNotificationsModal />
  </div>
</template>
