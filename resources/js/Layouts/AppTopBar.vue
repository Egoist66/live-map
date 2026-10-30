<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import ApplicationLogo from '@/Components/Brand/ApplicationLogo.vue'
import Avatar from 'primevue/avatar'
import { computed } from 'vue'
import { useViewportBreakpoints } from '@/composables/useViewportBreakpoints'
import { useDesktopTopNav } from '@/composables/useDesktopTopNav'
import { useTelegram } from '@/composables/useTelegram'

withDefaults(
  defineProps<{ user: any; avatarSrc: string; dashboardHref: string; badgeTotal: number; lockEnabled?: boolean; isBusiness?: boolean; showLove?: boolean; showFlow?: boolean; canSearchPeople?: boolean }>(),
  { isBusiness: false, showLove: true, showFlow: true, canSearchPeople: false },
)
const emit = defineEmits<{ (e: 'bell'): void; (e: 'menu', ev: Event): void; (e: 'lock'): void; (e: 'search'): void }>()

const { isBelowLg } = useViewportBreakpoints()
const { topNavPillClass, topNavBrandPillClass } = useDesktopTopNav()
const { isTelegram, isDesktopTelegram, closeMiniApp } = useTelegram()
/**
 * В Telegram на мобиле колокол и аватар живут в нижней навигации
 * (MobileBottomNav): в топбаре их прячем, чтобы не дублировать.
 * Обычный веб и десктопный TG — как было.
 */
const hideSystemButtons = computed(() => isTelegram.value && isBelowLg.value && !isDesktopTelegram.value)
/**
 * Десктопный Mini App (Windows/macOS, боковая панель справа):
 * у окна клиента нет видимого крестика поверх WebView —
 * показываем свою кнопку «Закрыть» (WebApp.close).
 */
const showTgClose = computed(() => isTelegram.value && isDesktopTelegram.value)
</script>
<template>
  <div class="mx-auto flex h-14 w-full min-w-0 max-w-[1280px] items-center gap-1 px-2 min-[411px]:h-16 min-[411px]:gap-2 min-[411px]:px-3 sm:px-6 xl:max-w-[1400px] 2xl:max-w-[1600px]">
    <Link :href="dashboardHref" class="min-w-0 shrink-0 rounded-xl active:scale-95 transition" aria-label="На главную">
      <ApplicationLogo />
    </Link>

    <nav aria-label="Основная навигация" class="panel-surface hidden lg:flex items-center gap-1 rounded-full p-1 shadow-soft shrink-0">
      <Link v-if="isBusiness" href="/cabinet" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition', topNavPillClass(route().current('cabinet.*'))]">Кабинет</Link>
      <Link :href="route('chat')" :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition relative', topNavPillClass(route().current('chat'))]">Чат</Link>
      <Link
        v-if="!isBusiness && showLove"
        :href="route('swipes')"
        title="ULove"
        :class="['px-4 py-1.5 rounded-full text-[13px] font-semibold transition inline-flex items-center', topNavPillClass(route().current('swipes'))]"
      >
        <span
          :class="[
            'text-[13px] font-black tracking-tight leading-none',
            route().current('swipes')
              ? '!text-white'
              : 'bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent',
          ]"
        >ULove</span>
      </Link>
      <Link v-if="!isBusiness && showFlow" :href="route('flow')" title="UFlow" :class="['px-4 py-1.5 rounded-full transition inline-flex items-center', topNavBrandPillClass(route().current('flow'))]"><span :class="['text-[13px] font-black tracking-tight leading-none', route().current('flow') ? '!text-white' : 'bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 dark:from-rose-500 dark:via-pink-500 dark:to-fuchsia-500 bg-clip-text text-transparent']">UFlow</span></Link>
    </nav>

    <span class="min-w-0 flex-1" />

    <div class="flex shrink-0 items-center gap-1 min-[411px]:gap-1.5 sm:gap-2">
      <button v-if="showTgClose" type="button" title="Закрыть Mini App" aria-label="Закрыть Mini App" class="topbar-round-btn grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white dark:bg-white/[0.06] border border-stone-200 dark:border-white/10 shadow-soft hover:bg-stone-50 dark:hover:bg-white/15 transition active:scale-95 min-[411px]:h-10 min-[411px]:w-10" @click="closeMiniApp()">
        <i class="pi pi-times text-stone-600 dark:text-zinc-300"></i>
      </button>
      <button v-if="canSearchPeople" @click="emit('search')" title="Поиск людей" aria-label="Поиск людей" class="topbar-round-btn grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white dark:bg-white/[0.06] border border-stone-200 dark:border-white/10 shadow-soft hover:bg-stone-50 dark:hover:bg-white/15 transition active:scale-95 min-[411px]:h-10 min-[411px]:w-10">
        <i class="pi pi-search text-stone-600 dark:text-zinc-300"></i>
      </button>
      <button v-if="lockEnabled" @click="emit('lock')" title="Заблокировать" aria-label="Заблокировать" class="topbar-round-btn grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white dark:bg-white/[0.06] border border-stone-200 dark:border-white/10 shadow-soft hover:bg-stone-50 dark:hover:bg-white/15 transition active:scale-95 min-[411px]:h-10 min-[411px]:w-10">
        <i class="pi pi-lock text-stone-600 dark:text-zinc-300"></i>
      </button>
      <button v-if="!hideSystemButtons" @click="emit('bell')" aria-label="Уведомления" class="topbar-round-btn relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white dark:bg-white/[0.06] border border-stone-200 dark:border-white/10 shadow-soft hover:bg-stone-50 dark:hover:bg-white/15 transition active:scale-95 min-[411px]:h-10 min-[411px]:w-10">
        <i class="pi pi-bell text-sm text-stone-600 dark:text-zinc-300"></i>
        <span v-if="badgeTotal" class="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white dark:border-[#0F121F] bg-red-500 px-1 text-[10px] font-bold text-white">{{ badgeTotal > 9 ? '9+' : badgeTotal }}</span>
        <span v-if="badgeTotal" class="absolute -top-1 -right-1 h-[18px] min-w-[18px] rounded-full bg-red-500 animate-ping opacity-30"></span>
      </button>
      <button v-if="!hideSystemButtons" @click="emit('menu', $event)" aria-label="Меню профиля" class="grid h-10 w-10 !min-h-[40px] shrink-0 place-items-center overflow-hidden rounded-full bg-white dark:bg-white/[0.06] border border-stone-200 dark:border-white/10 shadow-soft hover:bg-stone-50 dark:hover:bg-white/15 transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 sm:flex sm:h-11 sm:w-auto sm:items-center sm:gap-2 sm:px-3">
        <Avatar :image="avatarSrc" shape="circle" size="normal" class="!w-8 !h-8" />
        <span class="text-sm font-semibold text-ink-900 dark:text-white max-w-[120px] truncate hidden sm:inline">{{ user?.name }}</span>
      </button>
    </div>
  </div>
</template>
