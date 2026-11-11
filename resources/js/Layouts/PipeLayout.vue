<script setup lang="ts">
/**
 * Лейаут Pipes (pipe.ulove.by): компактная колонка в духе Threads,
 * свой верхний бар (логотип, колокольчик, меню профиля) и общий футер.
 * Цвета те же, что у ULove (brand rose + dark #0F121F).
 *
 * Главное меню/навигацию ULove тут не рендерим — это отдельный
 * сервис поверх ULove. Идёт только стандартная панель уведомлений
 * (BellNotificationsModal) и стандартный выход из аккаунта.
 *
 * Сессии общие с ulove.by (SESSION_DOMAIN), поэтому меню показывает
 * реального пользователя, а не гостя, если он залогинен на главном.
 */
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import Avatar from 'primevue/avatar'
import Menu from 'primevue/menu'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import GlobalNotificationToasts from '@/Components/Features/Feedback/GlobalNotificationToasts.vue'
import { usePipeApp } from '@/composables/usePipeApp'
import { usePipeRealtime } from '@/composables/usePipeRealtime'
import { useBellNotifications } from '@/composables/useBellNotifications'
import { useClientReady } from '@/composables/useClientReady'
import { useDropdownMenuStyle } from '@/composables/useDropdownMenuStyle'

/** Тяжёлая стандартная панель уведомлений ULove — асинхронно. */
const BellNotificationsModal = defineAsyncComponent(() => import('@/Components/Features/Feedback/BellNotificationsModal.vue'))

/**
 * Realtime-фон pipe-домена: транспорт realtime (сокет/поллер) и
 * тосты/шина уведомлений (GlobalNotificationToasts → useAppNotifications).
 */
usePipeRealtime()

const { mainHref, visitMain } = usePipeApp()

const me = computed(() => (usePage().props.auth as { user?: { id: number; name: string; avatar_url: string | null } }).user)
const profileHref = computed(() => (me.value ? mainHref(`/users/${me.value.id}`) : ''))

/** Стандартная панель уведомлений (общий state с BellNotificationsModal). */
const bell = useBellNotifications()
const { isClientReady } = useClientReady()
const { menuPt } = useDropdownMenuStyle()

/**
 * Меню профиля Pipe использует тот же стиль дропдауна, что и
 * стандартный AppUserMenu ULove (useDropdownMenuStyle), но ховер/фокус
 * пунктов красится глобальным CSS (`.pipe-user-menu`): меню телепортируется
 * в body, где Tailwind-варианты dark:hover на этом элементе нестабильны.
 */
const pipeMenuPt = {
  ...menuPt,
  itemLink: { class: 'group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer !text-sm !font-medium !text-stone-800 dark:!text-zinc-100 transition-colors' },
  submenuHeader: { class: '!px-3 !py-2 !text-[11px] !font-bold !uppercase !tracking-wide !text-stone-400 dark:!text-zinc-500' },
}

/** Пункт меню как в стандартном дропдауне ULove (AppUserMenu). */
interface PipeMenuItem {
  label?: string
  sublabel?: string
  icon?: string
  isHeader?: boolean
  separator?: boolean
  accent?: string
  danger?: boolean
  command?: () => void
}

const menu = ref()
const menuItems = ref<PipeMenuItem[]>([])

/**
 * Меню пользователя — то же, что в ULove: публичный профиль,
 * настройки и стандартный выход. Внешние ссылки — полные (главный сайт).
 */
function buildMenuItems(): void {
  const items: PipeMenuItem[] = [
    { label: me.value?.name ?? '', sublabel: '', isHeader: true },
    {
      label: 'Профиль в ULove',
      icon: 'pi pi-user',
      command: () => { if (profileHref.value) visitMain(`/users/${me.value?.id ?? ''}`) },
    },
    {
      label: 'Настройки',
      icon: 'pi pi-cog',
      command: () => { window.location.href = mainHref('/settings') },
    },
    { separator: true },
    {
      label: 'Выйти',
      icon: 'pi pi-sign-out',
      accent: 'red',
      danger: true,
      command: () => { void logout() },
    },
  ]

  menuItems.value = items
}

/** Стандартный выход: POST /logout (авторизация на главном сайте), затем главная. */
async function logout(): Promise<void> {
  try {
    await router.post('/logout', {}, {})
  } catch { /* всё равно уводим на главную */ }
  window.location.href = mainHref('/')
}

/** SPA-переход в ленту: полный релоад не нужен — layout персистентный. */
function goFeed(): void {
  router.visit(String(route('pipe.index')))
}

function openBell(): void {
  bell.open()
}

function openMenu(event: Event): void {
  buildMenuItems()
  menu.value?.toggle(event)
}

onMounted(() => {
  buildMenuItems()
  // Стандартная панель уведомлений: подгружаем счётчик непрочитанных,
  // чтобы колокольчик на pipe-странице показывал точку как в ULove.
  if (me.value) void bell.fetchAll()
})
</script>

<template>
  <div class="min-h-screen min-h-dvh bg-white dark:bg-[#0F121F] text-stone-900 dark:text-zinc-100">
    <Toast position="top-center" />
    <GlobalNotificationToasts />
    <BellNotificationsModal v-if="isClientReady" />

    <header class="sticky top-0 z-20 border-b border-stone-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0F121F]/85 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-[540px] items-center gap-2 px-3">
        <button
          type="button"
          class="flex items-center gap-2 rounded-xl px-1 py-1 transition hover:opacity-80 active:scale-95"
          aria-label="Pipes — открытая лента"
          @click="goFeed"
        >
          <span
            aria-hidden="true"
            class="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500 shadow-glow"
          >
            <!-- Логотип Pipes: поток информации — каскад укорачивающихся строк ленты (как треды) -->
            <svg
              viewBox="0 0 24 24"
              class="h-[18px] w-[18px] text-white"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              role="img"
            >
              <path d="M5 7h14" />
              <path d="M5 12h9.5" />
              <path d="M5 17h5.5" />
            </svg>
          </span>
          <span class="text-lg font-black tracking-tight">Pipes</span>
        </button>

        <span class="ml-auto" />

        <button
          v-if="me"
          type="button"
          class="relative mr-1 rounded-full grid place-items-center h-9 w-9 text-stone-600 dark:text-zinc-300 transition hover:bg-stone-100 dark:hover:bg-white/10 active:scale-95"
          aria-label="Уведомления"
          @click="openBell"
        >
          <i class="pi pi-bell text-lg" aria-hidden="true" />
          <span
            v-if="bell.unreadChats.value > 0"
            aria-hidden="true"
            class="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-rose-500 to-fuchsia-500 ring-2 ring-white dark:ring-[#0F121F]"
          />
        </button>

        <button
          v-if="me"
          type="button"
          class="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label="Меню профиля"
          @click="openMenu($event)"
        >
          <Avatar
            :image="me.avatar_url ?? undefined"
            :label="me.avatar_url ? undefined : me.name.slice(0, 1)"
            shape="circle"
            class="!bg-gradient-to-br !from-rose-500 !to-fuchsia-500 text-white"
          />
        </button>
        <Menu
          ref="menu"
          :model="menuItems"
          popup
          class="pipe-user-menu min-w-[200px] !bg-white dark:!bg-[#0F121F]/95 dark:!backdrop-blur-xl !border !border-stone-200 dark:!border-white/10 !rounded-[20px] !shadow-float dark:!shadow-[0_24px_70px_-16px_rgba(0,0,0,0.8)] !overflow-hidden !p-0"
          aria-label="Меню профиля"
          :pt="pipeMenuPt"
        />

        <a
          v-if="!me"
          :href="mainHref('/login')"
          class="ml-1 rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 px-4 py-1.5 text-sm font-bold text-white transition active:scale-95"
        >
          Войти
        </a>
      </div>
    </header>

    <main class="mx-auto min-h-[calc(100dvh-3.5rem-6rem)] max-w-[540px] px-3 pb-16">
      <slot />
    </main>

    <footer class="pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-6 text-center text-xs text-stone-400 dark:text-zinc-500 sm:pb-6">
      <nav class="flex items-center justify-center gap-3" aria-label="Справочные страницы главного сайта">
        <a :href="mainHref('/privacy')" class="hover:underline">Приватность</a>
        <span aria-hidden="true">·</span>
        <a :href="mainHref('/offer')" class="hover:underline">Правила</a>
        <span aria-hidden="true">·</span>
        <a :href="mainHref('/faq')" class="hover:underline">Помощь</a>
      </nav>
      <p class="mt-2">Pipes — часть ULove · {{ new Date().getFullYear() }}</p>
    </footer>

    <ConfirmDialog
      :style="{ width: '400px', maxWidth: '92vw' }"
      :pt="{
        root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-white/10 overflow-hidden !bg-white dark:!bg-[#0F121F]' },
        header: { class: '!p-5 !pb-0 !border-0' },
        title: { class: '!font-black !text-[17px] !tracking-tight' },
        content: { class: '!px-5 !py-4 !text-sm !text-stone-600 dark:!text-zinc-300 !leading-relaxed' },
        footer: { class: '!px-5 !pb-5 !pt-0 !border-0 !flex !gap-2' },
        pcAcceptButton: { root: { class: '!rounded-full !bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500 !border-0 !px-5' } },
        pcRejectButton: { root: { class: '!rounded-full !px-5' } },
        icon: { class: '!w-10 !h-10 !rounded-full !bg-gradient-to-br !from-rose-500 !to-fuchsia-500 !text-white !grid !place-items-center !self-center !shrink-0 !leading-none !mr-3 !text-base' },
      }"
    />
  </div>
</template>

<style>
/*
 * Меню профиля Pipes: PrimeVue телепортирует попап в <body>,
 * поэтому ховер пунктов красим глобальным CSS (класс .pipe-user-menu
 * на корне попапа), а не Tailwind-вариантами, которые на этом узле
 * перебивают друг друга — в тёмной теме ховер становился белым.
 * Светлая тема — мягкий stone-100, тёмная — белый оверлей 8%.
 */
.pipe-user-menu .p-menu-item-content {
  border-radius: 12px;
}

.pipe-user-menu .p-menu-item-link {
  border-radius: 12px;
  transition: background-color 0.15s ease;
}

.pipe-user-menu .p-menu-item-link:hover,
.pipe-user-menu .p-menu-item.p-focus .p-menu-item-link {
  background-color: #f5f5f4;
}

.dark .pipe-user-menu .p-menu-item-link:hover,
.dark .pipe-user-menu .p-menu-item.p-focus .p-menu-item-link {
  background-color: rgba(255, 255, 255, 0.08);
  color: #e4e4e7;
}
</style>
