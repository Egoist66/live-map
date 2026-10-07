<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { Link, router, usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import AppFooter from '@/Layouts/AppFooter.vue'
import ApplicationLogo from '@/Components/Brand/ApplicationLogo.vue'
import AppUserMenu from '@/Layouts/AppUserMenu.vue'
import Avatar from 'primevue/avatar'
import GlobalNotificationToasts from '@/Components/Features/Feedback/GlobalNotificationToasts.vue'
import NetworkStatusToast from '@/Components/Features/Feedback/NetworkStatusToast.vue'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import { useBusinessStore } from '@/stores/business'
import { useNavigation } from '@/composables/useNavigation'
import { useMobileBottomNav } from '@/composables/useMobileBottomNav'
import { useBadgeStore } from '@/stores/badges'
import { useBellNotifications } from '@/composables/useBellNotifications'
import { useAppNotifications } from '@/composables/useAppNotifications'
import { useBusinessRealtime } from '@/composables/useBusinessRealtime'
import { useGlobalDialogDismiss } from '@/composables/useGlobalDialogDismiss'
import { useSessionWatchdog } from '@/composables/useSessionWatchdog'
import { useNewDeviceAlert } from '@/composables/useNewDeviceAlert'
import type { BusinessVerificationStatus } from '@/types/entities/Business'

const BellNotificationsModal = defineAsyncComponent(() => import('@/Components/Features/Feedback/BellNotificationsModal.vue'))
const NewDeviceAlertDialog = defineAsyncComponent(() => import('@/Components/Features/Security/NewDeviceAlertDialog.vue'))

const page = usePage()
const store = useBusinessStore()
const { user, avatarSrc } = useNavigation()
const { navHidden } = useMobileBottomNav()
const badge = useBadgeStore()
const bell = useBellNotifications()
useAppNotifications()
useBusinessRealtime()
useGlobalDialogDismiss()
useSessionWatchdog()
useNewDeviceAlert()
const menu = ref()

onMounted(() => {
  void badge.init()
})

const status = computed<BusinessVerificationStatus>(
  () => (store.profile?.verification_status as BusinessVerificationStatus | undefined) ?? 'draft',
)

const companyName = computed(() => {
  const fromProfile = String(store.profile?.name ?? '').trim()
  if (fromProfile !== '') {
    return fromProfile
  }
  const fromUser = (user.value as unknown as { name?: string } | null)?.name
  return String(fromUser ?? '').trim() !== '' ? String(fromUser) : 'Мой бизнес'
})

const menuUser = computed(() => {
  const email = (user.value as unknown as { email?: string } | null)?.email ?? ''
  return { name: companyName.value, email }
})

/**
 * В навигации только рабочие разделы: карта, чаты, реквизиты.
 * Кабинет — по логотипу, настройки — из дропдауна компании.
 */
const nav = [
  { label: 'Карта', href: '/map', icon: 'pi pi-map-marker', match: (p: string) => p.startsWith('/map') },
  { label: 'Чаты', href: '/chat', icon: 'pi pi-comments', match: (p: string) => p.startsWith('/chat') },
  { label: 'Реквизиты', href: '/cabinet/onboarding', icon: 'pi pi-id-card', match: (p: string) => p.startsWith('/cabinet/onboarding') },
]

const currentPath = computed(() => {
  try {
    return new URL((page.url as string) ?? '/cabinet', 'http://x').pathname
  } catch {
    return '/cabinet'
  }
})

/**
 * Дропдаун компании без дублей навигации.
 *
 * Кабинет — по логотипу, Карта/Чаты/Реквизиты уже есть в десктопном
 * и мобильном меню — в дропдауне остаются только уникальные разделы.
 */
const menuItems = computed(() => [
  { label: companyName.value, sublabel: (user.value as { email?: string } | null)?.email || '', isHeader: true },
  { label: 'Мои пины', icon: 'pi pi-list', accent: 'teal', active: currentPath.value.startsWith('/cabinet/pins'), command: () => router.visit('/cabinet/pins') },
  { label: 'Настройки', icon: 'pi pi-cog', accent: 'slate', active: currentPath.value.startsWith('/cabinet/settings'), command: () => router.visit('/cabinet/settings') },
  { separator: true },
  { label: 'Выйти', icon: 'pi pi-sign-out', accent: 'red', danger: true, command: () => logout() },
])

function toggleMenu(event: Event): void {
  menu.value?.toggle(event)
}

function logout(): void {
  router.post(route('logout'))
}
</script>

<template>
  <div class="flex min-h-screen min-h-dvh flex-col bg-surface dark:bg-[#0F121F] overflow-x-clip">
    <header class="native-safe-top sticky top-0 z-50 glass border-b border-stone-200/70 dark:border-zinc-800 backdrop-blur">
      <div class="mx-auto max-w-[1280px] xl:max-w-[1400px] 2xl:max-w-[1600px] px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link href="/cabinet" class="min-w-0 shrink-0" aria-label="Кабинет">
          <ApplicationLogo pro />
        </Link>
        <BusinessVerificationBadge :status="status" class="hidden sm:inline-flex shrink-0" />
        <nav class="hidden lg:flex items-center gap-1 ml-4">
          <Link
            v-for="item in nav"
            :key="item.label"
            :href="item.href"
            :class="[
              'px-3.5 py-2 rounded-full text-sm font-semibold transition',
              item.match(currentPath)
                ? 'bg-[#F04D9F] !text-white hover:!text-white dark:bg-[#F04D9F] dark:!text-white'
                : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white',
            ]"
          >
            {{ item.label }}
          </Link>
        </nav>
        <div class="ml-auto flex items-center gap-2 shrink-0">
          <button type="button" aria-label="Уведомления" title="Уведомления" class="relative grid h-10 w-10 place-items-center rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition active:scale-95" @click="bell.open()">
            <i class="pi pi-bell text-sm text-stone-600 dark:text-zinc-300" />
            <span v-if="badge.total" class="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white dark:border-zinc-900 bg-red-500 px-1 text-[10px] font-bold text-white">{{ badge.total > 9 ? '9+' : badge.total }}</span>
            <span v-if="badge.total" class="absolute -top-1 -right-1 h-[18px] min-w-[18px] rounded-full bg-red-500 animate-ping opacity-30"></span>
          </button>
          <button type="button" aria-label="Меню компании" class="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition active:scale-95" @click="toggleMenu">
            <Avatar :image="avatarSrc" shape="circle" size="normal" class="!w-8 !h-8" />
          </button>
        </div>
      </div>
    </header>
    <AppUserMenu v-model:menu-ref="menu" :user="menuUser" :avatar-src="avatarSrc" :items="menuItems" />

    <div class="mx-auto max-w-[1280px] xl:max-w-[1400px] 2xl:max-w-[1600px] w-full min-w-0 px-4 sm:px-6 py-4 sm:py-6 flex-1">
      <slot />
    </div>

    <nav
      aria-label="Мобильная навигация бизнеса"
      :aria-hidden="navHidden ? 'true' : undefined"
      class="mobile-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-t border-stone-200 dark:border-zinc-800"
      style="padding-bottom: var(--sab)"
    >
      <div class="grid grid-cols-3">
        <Link
          v-for="item in nav"
          :key="item.label"
          :href="item.href"
          :class="['flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold min-w-0', item.match(currentPath) ? 'text-[#F04D9F] dark:text-[#F04D9F]' : 'text-stone-400 dark:text-zinc-500']"
        >
          <i :class="[item.icon, 'text-lg']" />
          <span class="truncate max-w-full">{{ item.label }}</span>
        </Link>
      </div>
    </nav>

    <div class="hidden lg:block mt-auto">
      <AppFooter />
    </div>
    <div class="lg:hidden h-16" aria-hidden="true" />
    <GlobalNotificationToasts />
    <NetworkStatusToast />
    <BellNotificationsModal />
    <NewDeviceAlertDialog />
  </div>
</template>
