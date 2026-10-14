<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import AppTopBar from '@/Layouts/AppTopBar.vue'
import AppUserMenu from '@/Layouts/AppUserMenu.vue'
import MobileBottomNav from '@/Components/Features/Navigation/MobileBottomNav.vue'
import AppFooter from '@/Layouts/AppFooter.vue'
import PageTransition from '@/Components/Features/Feedback/PageTransition.vue'
import RouteErrorBoundary from '@/Components/Features/Feedback/RouteErrorBoundary.vue'
import GlobalNotificationToasts from '@/Components/Features/Feedback/GlobalNotificationToasts.vue'
import NetworkStatusToast from '@/Components/Features/Feedback/NetworkStatusToast.vue'
import PwaInstallBanner from '@/Components/Features/Pwa/PwaInstallBanner.vue'
import PwaUpdateBanner from '@/Components/Features/Pwa/PwaUpdateBanner.vue'
import ConfirmDialog from 'primevue/confirmdialog'
import ScreenLockOverlay from '@/Components/Features/Security/ScreenLockOverlay.vue'
// Тяжёлые/редкие оверлеи — асинхронно: грузятся после mount параллельно,
// первый paint не блокируют. Тосты, скринлок и ConfirmDialog оставлены
// статическими — они нужны мгновенно (ранние уведомления, приватность).
const EmailVerificationBanner = defineAsyncComponent(() => import('@/Components/Features/Profile/EmailVerificationBanner.vue'))
const BellNotificationsModal = defineAsyncComponent(() => import('@/Components/Features/Feedback/BellNotificationsModal.vue'))
const AppHotkeysDialog = defineAsyncComponent(() => import('@/Components/Features/Feedback/AppHotkeysDialog.vue'))
const GlobalPeopleSearchDialog = defineAsyncComponent(() => import('@/Components/Features/Search/GlobalPeopleSearchDialog.vue'))
const MiniChatDock = defineAsyncComponent(() => import('@/Components/Features/Chat/MiniChatDock.vue'))
const FloatingWidgets = defineAsyncComponent(() => import('@/Components/Features/Widgets/FloatingWidgets.vue'))
const NewDeviceAlertDialog = defineAsyncComponent(() => import('@/Components/Features/Security/NewDeviceAlertDialog.vue'))
const TermsAcceptanceModal = defineAsyncComponent(() => import('@/Components/Features/Legal/TermsAcceptanceModal.vue'))
const AppUpdateModal = defineAsyncComponent(() => import('@/Components/Features/Updates/AppUpdateModal.vue'))
const SubscriptionRenewalDialog = defineAsyncComponent(() => import('@/Components/Features/Subscription/SubscriptionRenewalDialog.vue'))
const AiGuideDialog = defineAsyncComponent(() => import('@/Components/Features/AiAssistant/AiGuideDialog.vue'))
import { useLayoutRoute } from '@/composables/useLayoutRoute'
import { useAppLayout } from '@/composables/useAppLayout'
import { useAppHotkeys } from '@/composables/useAppHotkeys'
import { useScreenLock } from '@/composables/useScreenLock'
import { useScreenLockScroll } from '@/composables/useScreenLockScroll'
import { useGlobalDialogScrollLock } from '@/composables/useGlobalDialogScrollLock'
import { useGlobalDialogDismiss } from '@/composables/useGlobalDialogDismiss'
import { useClientReady } from '@/composables/useClientReady'
import { useAiEnabled } from '@/composables/useAiEnabled'
import { useTermsAcceptance } from '@/composables/useTermsAcceptance'
import { useSessionWatchdog } from '@/composables/useSessionWatchdog'
import { useNewDeviceAlert } from '@/composables/useNewDeviceAlert'
import { onMounted } from 'vue'

const { badge, user, avatarSrc, dashboardHref, bell, updates, menu, menuItems, navVisibility, isAdmin, isBusinessAccount, toggleMenu, logout } = useAppLayout()

/**
 * Реактивный маршрут лейаута: шапка и фрейм `main`
 * переключаются при каждом переходе Inertia.
 *
 * Напрямую `route().current()` в `computed` здесь нельзя: Ziggy читает
 * `window.location` и не реактивен — флаг замирал на первой странице сессии
 * и `main` навсегда оставался в `overflow-hidden` после ухода со свайпов
 * (скролл профиля на мобиле пропадал до перезагрузки).
 */
const layoutRoute = useLayoutRoute()
const { isClientReady } = useClientReady()
const aiFlag = useAiEnabled()

/**
 * Пока не принята оферта — никаких других блокирующих модалок поверх:
 * сначала согласие, потом «Что нового». Иначе две modal-маски
 * наслаиваются и верстка выглядит поломанной.
 */
const { needsAcceptance } = useTermsAcceptance()
useSessionWatchdog()
useNewDeviceAlert()
const hotkeys = useAppHotkeys()
const screenLock = useScreenLock()
useScreenLockScroll()
useGlobalDialogScrollLock()
useGlobalDialogDismiss()
onMounted(() => { screenLock.init(); hotkeys.init() })
</script>
<template>
  <div class="flex min-h-screen min-h-dvh flex-col bg-surface dark:bg-[#0F121F] overflow-x-clip">
    <header v-if="!layoutRoute.isSwipesRoute.value && !layoutRoute.isAdminRoute.value" class="native-safe-top sticky top-0 z-50 glass border-b border-stone-200/70 dark:border-zinc-800 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-zinc-900/70">
      <AppTopBar :user="user" :avatar-src="avatarSrc" :dashboard-href="dashboardHref" :badge-total="badge.total" :lock-enabled="screenLock.enabled.value" :is-business="isBusinessAccount" :show-map="navVisibility.showMap" :show-love="navVisibility.showLove" :show-flow="navVisibility.showFlow" @bell="bell.open()" @menu="toggleMenu" @lock="screenLock.lockNow()" />
    </header>
    <AppUserMenu v-model:menu-ref="menu" :user="user" :avatar-src="avatarSrc" :items="(menuItems as any)" />
    <div v-if="layoutRoute.isSwipesRoute.value" class="native-safe-top lg:hidden w-full shrink-0" aria-hidden="true" />
    <EmailVerificationBanner />
    <div v-if="$slots.header" class="bg-white dark:bg-zinc-900 border-b border-stone-200/60 dark:border-zinc-800">
      <div class="mx-auto max-w-[1280px] xl:max-w-[1400px] 2xl:max-w-[1600px] px-4 sm:px-6 py-4 sm:py-6"><slot name="header" /></div>
    </div>
    <main :class="layoutRoute.isAdminRoute.value ? 'flex-1 pb-0' : (layoutRoute.isScrollLockedPage.value ? 'flex-1 pb-0 lg:pb-0 overflow-hidden overscroll-none' : 'flex-1 pb-[calc(var(--app-bottomnav)+var(--sab))] lg:pb-0')">
      <!-- Граница ошибок роута: краш страницы показывает панель
           восстановления вместо белого экрана и не отравляет корневой
           инстанс — «назад» продолжает работать. См. useRouteErrorBoundary. -->
      <RouteErrorBoundary>
        <!-- Консоль — без PageTransition: кроссфейд держит старое и новое дерево
             друг под другом ~350мс, и шапка админки это время видна внизу страницы,
             а потом прыгает наверх. WP-режиму анимация не нужна — мгновенно. -->
        <div v-if="layoutRoute.isAdminRoute.value" class="min-w-0 w-full">
          <slot />
        </div>
        <PageTransition v-else><slot /></PageTransition>
      </RouteErrorBoundary>
    </main>
    <div v-if="!layoutRoute.isChatRoute.value && !layoutRoute.isMapRoute.value && !layoutRoute.isSwipesRoute.value && !layoutRoute.isAdminRoute.value" class="mt-auto hidden pb-[calc(var(--app-bottomnav)+var(--sab))] lg:block lg:pb-0">
      <AppFooter />
    </div>
    <MobileBottomNav v-if="!layoutRoute.isAdminRoute.value" @bell="bell.open()" @menu="toggleMenu" />
    <!-- Единая панель виджетов (мини-чат + AI): один лаунчер вместо
         россыпи FAB по углам, на мобиле — над нижней навигацией,
         в админке скрыта полностью (там своя консоль). -->
    <FloatingWidgets v-if="!layoutRoute.isAdminRoute.value" />
    <!-- Оверлеи (сырые Teleport + Transition) монтируем только после гидратации:
         иначе SSR-краш `insertBefore of null` в Teleport.process. См. useClientReady. -->
    <template v-if="isClientReady">
      <GlobalNotificationToasts />
      <NetworkStatusToast />
      <BellNotificationsModal />
      <NewDeviceAlertDialog />
      <PwaInstallBanner />
      <PwaUpdateBanner />
      <AppHotkeysDialog />
      <AiGuideDialog v-if="aiFlag.canSeeAi.value" />
      <GlobalPeopleSearchDialog />
      <MiniChatDock v-if="!layoutRoute.isChatRoute.value && !layoutRoute.isAdminRoute.value" />
      <ScreenLockOverlay />
      <TermsAcceptanceModal />
      <SubscriptionRenewalDialog />
      <AppUpdateModal v-if="!needsAcceptance" :update="updates.current.value" :position="0" :total="updates.queue.value.length" @read="updates.dismissCurrent()" @later="updates.snooze()" @all="updates.dismissAll()" />
      <ConfirmDialog :style="{ width: '400px', maxWidth: '92vw' }" :pt="{ root: { class: '!rounded-[24px] max-sm:!rounded-b-none !border-stone-200 dark:!border-white/10 overflow-hidden !bg-white dark:!bg-zinc-900' }, header: { class: '!p-5 !pb-0 !border-0' }, title: { class: '!font-black !text-[17px] !tracking-tight' }, content: { class: '!px-5 !py-4 !text-sm !text-stone-600 dark:!text-zinc-300 !leading-relaxed' }, footer: { class: '!px-5 !pb-5 !pt-0 !border-0 !flex !gap-2' }, pcAcceptButton: { root: { class: '!rounded-full !bg-gradient-to-r !from-rose-500 !to-red-600 !border-0 !px-5 !shadow-glow' } }, pcRejectButton: { root: { class: '!rounded-full !px-5' } }, icon: { class: '!w-10 !h-10 !rounded-2xl !bg-gradient-to-br !from-rose-500 !to-red-600 !text-white !grid !place-items-center !mr-3 !text-base' } }">
      </ConfirmDialog>
    </template>
  </div>
</template>
