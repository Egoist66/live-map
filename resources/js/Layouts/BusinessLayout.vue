<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import AppFooter from '@/Layouts/AppFooter.vue'
import GlobalNotificationToasts from '@/Components/Features/Feedback/GlobalNotificationToasts.vue'
import BusinessVerificationBadge from '@/Components/Features/Business/BusinessVerificationBadge.vue'
import { useBusinessStore } from '@/stores/business'
import type { BusinessVerificationStatus } from '@/types/entities/Business'

const page = usePage()
const store = useBusinessStore()

const user = computed(() => (page.props as unknown as { auth?: { user?: unknown } }).auth?.user ?? null)
const status = computed<BusinessVerificationStatus>(
  () => (store.profile?.verification_status as BusinessVerificationStatus | undefined) ?? 'draft',
)

const nav = [
  { label: 'Дашборд', href: '/business', icon: 'pi pi-th-large', match: (p: string) => p === '/business' },
  { label: 'Карта', href: '/map', icon: 'pi pi-map-marker', match: (p: string) => p.startsWith('/map') },
  { label: 'Чаты', href: '/chat', icon: 'pi pi-comments', match: (p: string) => p.startsWith('/chat') },
  { label: 'Реквизиты', href: '/business/onboarding', icon: 'pi pi-id-card', match: (p: string) => p.startsWith('/business/onboarding') },
]

const currentPath = computed(() => {
  try {
    return new URL((page.url as string) ?? '/business', 'http://x').pathname
  } catch {
    return '/business'
  }
})

function logout(): void {
  import('@inertiajs/vue3').then(({ router }) => router.post(route('logout')))
}
</script>

<template>
  <div class="flex min-h-screen min-h-dvh flex-col bg-surface dark:bg-[#0B0F1A] overflow-x-clip">
    <header class="native-safe-top sticky top-0 z-50 glass border-b border-stone-200/70 dark:border-zinc-800 backdrop-blur">
      <div class="mx-auto max-w-[1280px] px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link href="/business" class="flex items-center gap-2 shrink-0">
          <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 grid place-items-center text-white"><i class="pi pi-briefcase text-sm" /></span>
          <span class="font-black tracking-tight text-[17px] dark:text-white">Бизнес<span class="font-light text-stone-500"> · кабинет</span></span>
        </Link>
        <BusinessVerificationBadge :status="status" class="hidden sm:inline-flex" />
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
        <div class="ml-auto flex items-center gap-2">
          <Link href="/map" class="hidden sm:inline-flex text-sm font-semibold text-stone-500 dark:text-zinc-400 hover:text-ink-900 dark:hover:text-white px-3 py-2">Карта</Link>
          <button type="button" class="w-9 h-9 rounded-full bg-stone-100 dark:bg-zinc-800 grid place-items-center text-stone-500 dark:text-zinc-300" title="Выйти" @click="logout">
            <i class="pi pi-sign-out text-sm" />
          </button>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-[1280px] w-full px-4 sm:px-6 py-4 sm:py-6 flex-1">
      <slot />
    </div>

    <nav class="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-t border-stone-200 dark:border-zinc-800" style="padding-bottom: var(--sab)">
      <div class="grid grid-cols-4">
        <Link
          v-for="item in nav"
          :key="item.label"
          :href="item.href"
          :class="['flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', item.match(currentPath) ? 'text-indigo-600 dark:text-indigo-400' : 'text-stone-400 dark:text-zinc-500']"
        >
          <i :class="[item.icon, 'text-lg']" />
          {{ item.label }}
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
