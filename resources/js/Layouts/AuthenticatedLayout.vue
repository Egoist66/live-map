<script setup lang="ts">
import { ref, computed } from 'vue'
import ApplicationLogo from '@/Components/ApplicationLogo.vue'
import { Link, router } from '@inertiajs/vue3'
import { useBadgeStore } from '@/stores/badges'
import { usePresence } from '@/composables/usePresence'
import { useNavigation } from '@/composables/useNavigation'
import { useAppNotifications } from '@/composables/useAppNotifications'
import MobileBottomNav from '@/Components/MobileBottomNav.vue'
import PageTransition from '@/Components/PageTransition.vue'
import GlobalNotificationToasts from '@/Components/GlobalNotificationToasts.vue'
import Avatar from 'primevue/avatar'
import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Menu from 'primevue/menu'
import Toolbar from 'primevue/toolbar'

const badge = useBadgeStore()
const presence = usePresence()
const { user, avatarSrc, dashboardHref, settingsHref } = useNavigation()
const appNotes = useAppNotifications()
import { onMounted, onBeforeUnmount } from 'vue'
onMounted(() => { badge.init(); presence.connect(); appNotes.init() })
onBeforeUnmount(() => presence.disconnect())
router.on('navigate', () => { presence.connect(); showDrawer.value = false })

const showDrawer = ref(false)
const menu = ref()
const menuItems = computed(() => [
  { label: user.value?.name || '', sublabel: user.value?.email || '', isHeader: true },
  { separator: true },
  { label: 'Профиль', icon: 'pi pi-user', command: () => router.visit(dashboardHref.value) },
  { label: 'Настройки', icon: 'pi pi-cog', command: () => router.visit(settingsHref.value) },
  { label: 'Карта', icon: 'pi pi-map', command: () => router.visit(route('map')) },
  { separator: true },
  { label: 'Выйти', icon: 'pi pi-sign-out', command: () => router.post(route('logout')) },
])
function toggleMenu(e: Event) { menu.value.toggle(e) }
</script>

<template>
  <div class="min-h-screen bg-surface dark:bg-[#0B0F1A] overflow-x-hidden">
    <div class="sticky top-0 z-50 glass border-b border-stone-200/70 dark:border-zinc-800 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-900/70">
      <Toolbar class="!p-0 !border-0 !rounded-none !bg-transparent !min-h-[64px] !h-[64px]" :pt="{ root: { class: '!min-h-[64px] !h-[64px] !bg-transparent !border-0 !p-0' }, start: { class: 'flex items-center gap-8 h-[64px]' }, end: { class: 'flex items-center gap-2 h-[64px]' } }">
        <template #start>
          <div class="flex items-center gap-8 h-[64px] px-4 sm:px-6 max-w-[1280px] mx-auto w-full">
            <Link :href="dashboardHref" class="shrink-0"><ApplicationLogo /></Link>
            <div class="hidden lg:flex items-center gap-1 bg-stone-100/80 dark:bg-zinc-800 p-1 rounded-full border border-stone-200/60 dark:border-zinc-700">
              <Link :href="dashboardHref" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', route().current('dashboard') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">Профиль</Link>
              <Link :href="route('map')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', route().current('map') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">Карта</Link>
              <Link :href="route('chat')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition relative', route().current('chat') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">
                Чат
                <Badge v-if="badge.total" :value="badge.total > 99 ? '99+' : String(badge.total)" severity="danger" class="!text-[10px] ml-1" />
              </Link>
              <Link :href="route('faq')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', route().current('faq') ? 'bg-white dark:bg-zinc-700 shadow-soft text-ink-900 dark:text-white border border-stone-200' : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900']">FAQ</Link>
            </div>
          </div>
        </template>
        <template #end>
          <div class="flex items-center gap-2 h-[64px] pr-4 sm:pr-6">
            <Link :href="route('chat')" class="relative w-10 h-10 grid place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition">
              <i class="pi pi-bell text-stone-600 dark:text-zinc-300"></i>
              <span v-if="badge.total" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-zinc-900">{{ badge.total>99?'99+':badge.total }}</span>
              <span v-if="badge.total" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 animate-ping opacity-30"></span>
            </Link>
            <Link href="/map" class="hidden sm:inline-flex items-center gap-2 bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-ink-800 transition">+ Создать пин</Link>
            <Button @click="toggleMenu" severity="secondary" outlined rounded class="hidden sm:inline-flex !p-1 !pl-2 !pr-3 !bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 shadow-soft">
              <Avatar :image="avatarSrc" shape="circle" size="normal" class="!w-7 !h-7" />
              <span class="text-sm font-semibold text-ink-900 dark:text-white max-w-[120px] truncate hidden sm:inline">{{ user?.name }}</span>
              <i class="pi pi-chevron-down text-xs text-stone-500" />
            </Button>
            <Menu ref="menu" :model="menuItems" popup class="!min-w-[260px] !bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-2xl !shadow-xl overflow-hidden" :pt="{ root: { class: '!bg-white dark:!bg-zinc-900 !border !border-stone-200 dark:!border-zinc-800 !rounded-2xl shadow-xl' }, list: { class: '!bg-white dark:!bg-zinc-900 !p-1' }, item: { class: '!bg-transparent' } }">
              <template #item="{ item, props }">
                <div v-if="item.isHeader" class="px-4 py-3 flex gap-3 border-b border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50">
                  <Avatar :image="avatarSrc" shape="circle" size="large" class="!w-9 !h-9" />
                  <div class="min-w-0"><div class="text-sm font-semibold truncate text-ink-900 dark:text-white">{{ user?.name }}</div><div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ user?.email }}</div></div>
                </div>
                <a v-else-if="item.separator" class="my-1 border-t border-stone-200 dark:border-zinc-700 block" />
                <a v-else v-bind="props.action" class="flex items-center gap-2 px-3 py-2.5 rounded-xl mx-1 my-0.5 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-200 transition">
                  <i :class="item.icon + ' text-stone-500 dark:text-zinc-400'" /><span class="text-sm flex-1 font-medium">{{ item.label }}</span>
                </a>
              </template>
            </Menu>
            <Button @click="showDrawer = !showDrawer" severity="secondary" outlined rounded class="lg:!hidden !w-10 !h-10 !p-0 !bg-white dark:!bg-zinc-800 !border-stone-200 dark:!border-zinc-700 shadow-soft" :icon="showDrawer ? 'pi pi-times' : 'pi pi-bars'" />
          </div>
        </template>
      </Toolbar>
    </div>

    <Drawer v-model:visible="showDrawer" position="right" class="!w-[320px] !bg-white dark:!bg-zinc-900" :pt="{ root: { class: '!bg-white dark:!bg-zinc-900 !border-l !border-stone-200 dark:!border-zinc-800' }, header: { class: '!bg-white dark:!bg-zinc-900 !text-ink-900 dark:!text-white !border-b !border-stone-200 dark:!border-zinc-800' }, content: { class: '!bg-white dark:!bg-zinc-900 !text-stone-700 dark:!text-zinc-200' }, footer: { class: '!bg-white dark:!bg-zinc-900 !border-t !border-stone-200 dark:!border-zinc-800' } }" header="Меню">
      <template #header><ApplicationLogo /></template>
      <div class="space-y-1">
        <Link :href="dashboardHref" class="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="showDrawer=false">Профиль</Link>
        <Link :href="settingsHref" class="flex p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="showDrawer=false">Настройки</Link>
        <Link :href="route('map')" class="flex p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="showDrawer=false">Карта</Link>
        <Link :href="route('chat')" class="flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="showDrawer=false">Чат <Badge v-if="badge.total" :value="badge.total>99?'99+':String(badge.total)" severity="danger" /></Link>
        <Link :href="route('faq')" class="flex p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 font-medium text-ink-900 dark:text-white" @click="showDrawer=false">FAQ</Link>
        <Link href="/map" class="flex bg-ink-900 dark:bg-white dark:text-ink-900 text-white rounded-full px-4 py-2.5 text-sm font-semibold justify-center mt-2" @click="showDrawer=false">+ Создать пин</Link>
      </div>
      <template #footer>
        <div class="flex items-center gap-3 p-3 border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <Avatar :image="avatarSrc" shape="circle" />
          <div class="min-w-0 flex-1"><div class="text-sm font-semibold truncate text-ink-900 dark:text-white">{{ user?.name }}</div><div class="text-xs text-stone-500 dark:text-zinc-400 truncate">{{ user?.email }}</div></div>
          <Button icon="pi pi-sign-out" severity="secondary" text rounded @click="router.post(route('logout'))" />
        </div>
      </template>
    </Drawer>

    <header v-if="$slots.header" class="bg-white dark:bg-zinc-900 border-b border-stone-200/60 dark:border-zinc-800">
      <div class="mx-auto max-w-[1280px] px-4 sm:px-6 py-6"><slot name="header" /></div>
    </header>
    <main :class="route().current('chat') || route().current('map') ? 'pb-0 lg:pb-0' : 'pb-[76px] lg:pb-0'">
      <PageTransition>
        <slot />
      </PageTransition>
    </main>
    <MobileBottomNav />
    <GlobalNotificationToasts />
  </div>
</template>
