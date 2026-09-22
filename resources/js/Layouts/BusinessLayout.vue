<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link, router, usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import AppFooter from '@/Layouts/AppFooter.vue'
import AppUserMenu from '@/Layouts/AppUserMenu.vue'
import Avatar from 'primevue/avatar'
import GlobalNotificationToasts from '@/Components/Features/Feedback/GlobalNotificationToasts.vue'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import { useBusinessStore } from '@/stores/business'
import { useNavigation } from '@/composables/useNavigation'
import { useMobileBottomNav } from '@/composables/useMobileBottomNav'
import type { BusinessVerificationStatus } from '@/types/entities/Business'

const page = usePage()
const store = useBusinessStore()
const { user, avatarSrc } = useNavigation()
const { navHidden } = useMobileBottomNav()
const menu = ref()

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

const nav = [
  { label: 'Дашборд', href: '/cabinet', icon: 'pi pi-th-large', match: (p: string) => p === '/cabinet' },
  { label: 'Карта', href: '/map', icon: 'pi pi-map-marker', match: (p: string) => p.startsWith('/map') },
  { label: 'Чаты', href: '/chat', icon: 'pi pi-comments', match: (p: string) => p.startsWith('/chat') },
  { label: 'Реквизиты', href: '/cabinet/onboarding', icon: 'pi pi-id-card', match: (p: string) => p.startsWith('/cabinet/onboarding') },
  { label: 'Настройки', href: '/cabinet/settings', icon: 'pi pi-cog', match: (p: string) => p.startsWith('/cabinet/settings') },
]

const currentPath = computed(() => {
  try {
    return new URL((page.url as string) ?? '/cabinet', 'http://x').pathname
  } catch {
    return '/cabinet'
  }
})

const menuItems = computed(() => [
  { label: companyName.value, sublabel: (user.value as { email?: string } | null)?.email || '', isHeader: true },
  { separator: true },
  { label: 'Кабинет', icon: 'pi pi-th-large', accent: 'violet', active: currentPath.value === '/cabinet', command: () => router.visit('/cabinet') },
  { label: 'Реквизиты компании', icon: 'pi pi-id-card', accent: 'slate', active: currentPath.value.startsWith('/cabinet/onboarding'), command: () => router.visit('/cabinet/onboarding') },
  { label: 'Настройки', icon: 'pi pi-cog', accent: 'slate', active: currentPath.value.startsWith('/cabinet/settings'), command: () => router.visit('/cabinet/settings') },
  { label: 'Карта', icon: 'pi pi-map', accent: 'teal', active: currentPath.value.startsWith('/map'), command: () => router.visit('/map') },
  { label: 'Чаты', icon: 'pi pi-comments', accent: 'sky', active: currentPath.value.startsWith('/chat'), command: () => router.visit('/chat') },
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
  <div class="flex min-h-screen min-h-dvh flex-col bg-surface dark:bg-[#0B0F1A] overflow-x-clip">
    <header class="native-safe-top sticky top-0 z-50 glass border-b border-stone-200/70 dark:border-zinc-800 backdrop-blur">
      <div class="mx-auto max-w-[1280px] px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link href="/cabinet" class="flex items-center gap-2 min-w-0 shrink-0">
          <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 grid place-items-center text-white shrink-0"><i class="pi pi-briefcase text-sm" /></span>
          <span class="font-black tracking-tight text-[17px] dark:text-white truncate">Бизнес<span class="font-light text-stone-500"> · кабинет</span></span>
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
                ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
                : 'text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white',
            ]"
          >
            {{ item.label }}
          </Link>
        </nav>
        <div class="ml-auto flex items-center gap-2 shrink-0">
          <Link href="/map" class="hidden sm:inline-flex text-sm font-semibold text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white px-3 py-2">Карта</Link>
          <button type="button" aria-label="Меню компании" class="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-soft hover:bg-stone-50 dark:hover:bg-zinc-700 transition active:scale-95" @click="toggleMenu">
            <Avatar :image="avatarSrc" shape="circle" size="normal" class="!w-8 !h-8" />
          </button>
        </div>
      </div>
    </header>
    <AppUserMenu v-model:menu-ref="menu" :user="menuUser" :avatar-src="avatarSrc" :items="menuItems" />

    <div class="mx-auto max-w-[1280px] w-full min-w-0 px-4 sm:px-6 py-4 sm:py-6 flex-1">
      <slot />
    </div>

    <nav
      aria-label="Мобильная навигация бизнеса"
      :aria-hidden="navHidden ? 'true' : undefined"
      class="mobile-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-t border-stone-200 dark:border-zinc-800"
      style="padding-bottom: var(--sab)"
    >
      <div class="grid grid-cols-5">
        <Link
          v-for="item in nav"
          :key="item.label"
          :href="item.href"
          :class="['flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold min-w-0', item.match(currentPath) ? 'text-indigo-600 dark:text-indigo-400' : 'text-stone-400 dark:text-zinc-500']"
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
  </div>
</template>
