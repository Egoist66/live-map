import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { route } from '@/route'
import { useAppModulesStore } from '@/stores/appModules'
import { useBadgeStore } from '@/stores/badges'
import { usePresence } from '@/composables/usePresence'
import { useNavigation } from '@/composables/useNavigation'
import { useAppNotifications } from '@/composables/useAppNotifications'
import { useBellNotifications } from '@/composables/useBellNotifications'
import { usePinActivity } from '@/composables/usePinActivity'
import { useAdminReports } from '@/composables/useAdminReports'
import { useAppUpdates } from '@/composables/useAppUpdates'
import { useBuildVersion } from '@/composables/useBuildVersion'
import { useSecurityImpersonations } from '@/composables/useSecurityImpersonations'
import { useAuthSession } from '@/composables/useAuthSession'
import { useLastRoute } from '@/composables/useLastRoute'
import { useRealtimeMode } from '@/composables/useRealtimeMode'
import { useRealtimePoller, watchRealtimeMode } from '@/composables/useRealtimePoller'
import { usePwaPushAuto } from '@/composables/usePwaPushAuto'
import { useIdleTask } from '@/composables/useIdleTask'
import { useModuleRouteGuard } from '@/composables/useModuleRouteGuard'
import { useTelegram } from '@/composables/useTelegram'
import { useViewportBreakpoints } from '@/composables/useViewportBreakpoints'

export function useAppLayout() {
  const badge = useBadgeStore()
  const presence = usePresence()
  const { user, avatarSrc, dashboardHref, settingsHref } = useNavigation()
  const appNotes = useAppNotifications()
  const bell = useBellNotifications()
  const pinActivity = usePinActivity()
  const adminReports = useAdminReports()
  const updates = useAppUpdates()
  const buildVersion = useBuildVersion()
  const proc = useSecurityImpersonations()
  const authSession = useAuthSession()
  const realtimeMode = useRealtimeMode()
  const realtimePoller = useRealtimePoller()
  usePwaPushAuto()
  const menu = ref()
  const modules = useAppModulesStore()
  const { isTelegram } = useTelegram()
  const { isBelowLg } = useViewportBreakpoints()

  try {
    useModuleRouteGuard().init()
  } catch {
  }
  try {
    modules.ensureInit(user.value)
  } catch {
  }
  watch(user, (next) => {
    try {
      modules.syncUserRef(next)
    } catch {
    }
  })
  const isAdmin = computed(() => !!user.value?.is_admin || user.value?.role === 'admin')
  const isModerator = computed(() => isAdmin.value || user.value?.role === 'moderator')
  /**
   * Бизнес-аккаунт: в дропдауне только бизнес-разделы
   * (кабинет, карта, чаты, настройки бизнеса) — никаких
   * свайпов, ULove и UFlow.
   */
  const isBusinessAccount = computed(() => {
    try {
      return (user.value as { account_type?: string } | null)?.account_type === 'business'
    } catch {
      return false
    }
  })
  /**
   * Пункты дропдауна профиля без дублей навигации.
   *
   * Ядро (Профиль, Чат, ULove) живёт в топбаре и нижнем меню —
   * в дропдаун не дублируется. Доп.модули (Карта, UFlow, Районы)
   * добавляются сюда при их активации, но только на мобиле:
   * на десктопе они уже есть в топбаре. Остаются всегда:
   * модерация, настройки и выход.
   * Исключение — Telegram Mini App: там в нижнем меню нет ссылки
   * «Профиль» (вместо неё аватар с этим дропдауном), поэтому
   * докладываем «Мой профиль».
   */
  const menuItems = computed(() => {
    const header = { label: user.value?.name || '', sublabel: user.value?.email || '', isHeader: true }
    const moderation = isModerator.value
      ? [{ label: 'Панель модерации', icon: 'pi pi-shield', accent: 'amber', active: route().current('admin'), command: () => router.visit(route('admin')) }]
      : []
    const logoutItem = { label: 'Выйти', icon: 'pi pi-sign-out', accent: 'red', danger: true, command: () => doLogout() }

    if (isBusinessAccount.value) {
      return [
        header,
        { separator: true },
        ...moderation,
        { label: 'Настройки бизнеса', icon: 'pi pi-cog', accent: 'slate', active: route().current('cabinet.settings'), command: () => router.visit('/cabinet/settings') },
        { separator: true },
        logoutItem,
      ]
    }

    const personSections: any[] = [
      { label: 'Настройки', icon: 'pi pi-cog', accent: 'slate', active: route().current('profile.edit'), command: () => router.visit(settingsHref.value) },
    ]

    /**
     * Telegram Mini App: в нижнем меню нет ссылки «Профиль»
     * (вместо неё аватар с этим дропдауном), поэтому докладываем
     * «Мой профиль». В обычном вебе профиль уже есть в нижнем
     * меню — пусто.
     */
    const telegramSections: any[] = !isTelegram.value
      ? []
      : [
          { label: 'Мой профиль', icon: 'pi pi-user', accent: 'sky', active: route().current('dashboard'), command: () => router.visit(dashboardHref.value) },
        ]

    /**
     * Доп.модули в дропдауне — только на мобиле (< lg).
     *
     * Внизу на мобиле лишь ядро (Профиль, Чат, ULove в вебе;
     * Чат, ULove, уведомления и профиль в Telegram), поэтому
     * включённые доп.модули добавляются сюда при их активации:
     * Карта (UPin), UFlow, Районы. На десктопе всё это уже есть
     * в топбаре — дропдаун остаётся без дублей навигации.
     */
    const showExtraModules = isBelowLg.value
    const extraModuleSections: any[] = !showExtraModules
      ? []
      : [
          ...(modules.isEnabled('upin')
            ? [{ label: 'Карта', icon: 'pi pi-map-marker', accent: 'teal', active: route().current('map'), command: () => router.visit(route('map')) }]
            : []),
          ...(modules.isEnabled('uflow')
            ? [{ label: 'UFlow', svg: 'flow', accent: 'slate', active: route().current('flow'), command: () => router.visit(route('flow')) }]
            : []),
          ...(modules.isEnabled('districts')
            ? [{ label: 'Районы', icon: 'pi pi-users', accent: 'teal', active: route().current('districts.*'), command: () => router.visit(route('districts.index')) }]
            : []),
        ]

    return [
      header,
      { separator: true },
      ...moderation,
      ...telegramSections,
      ...extraModuleSections,
      ...personSections,
      { separator: true },
      logoutItem,
    ]
  })


  const navVisibility = computed(() => ({
    showMap: modules.isEnabled('upin'),
    showLove: modules.isEnabled('ulove'),
    showFlow: modules.isEnabled('uflow'),
  }))
  function toggleMenu(e: Event) { menu.value.toggle(e) }
  async function doLogout() {
    try { authSession.resetAll() } catch {}
    try { await useLastRoute().forgetLastRoute() } catch {}
    try {
      const { getSubscription } = await import('@/pwa/push.service')
      const { removePushSubscription } = await import('@/pwa/pwa.api')
      const sub = await getSubscription().catch(() => null)
      if (sub?.endpoint) await removePushSubscription(sub.endpoint).catch(() => {})
    } catch {}
    try {
      const { resetEchoSession } = await import('@/echo')
      resetEchoSession([])
    } catch {}
    router.post(route('logout'), {}, { onSuccess: () => { try { authSession.resetAll() } catch {} } })
  }
  function logout() { doLogout() }
  /**
   * Выбор транспорта realtime: polling при включённом запасном режиме,
   * иначе сокеты + редкий вотчер смены режима.
   */
  async function initRealtime(): Promise<void> {
    try {
      watchRealtimeMode((next) => realtimePoller.ensure(next))
      const current = await realtimeMode.init()
      realtimePoller.ensure(current)
    } catch {}
  }
  // Некритичное — в idle: 8 инитов (~15 API) больше не штормят сеть
  // и main thread до первого paint (Lighthouse: TBT 1100мс, TTI 12.7с).
  // Топбар/меню рисуются сразу, цифры бейджей догоняют через ~1.5с.
  const { runWhenIdle } = useIdleTask()
  onMounted(() => {
    void runWhenIdle(async () => {
      await Promise.allSettled([
        badge.init(),
        presence.connect(),
        appNotes.init(),
        pinActivity.init(),
        adminReports.init(),
        updates.init(),
        proc.init(),
        buildVersion.init(),
        initRealtime(),
      ])
    })
  })
  onBeforeUnmount(() => presence.disconnect())
  router.on('navigate', () => { presence.connect() })
  return { badge, presence, user, avatarSrc, dashboardHref, settingsHref, bell, pinActivity, adminReports, updates, menu, menuItems, navVisibility, isAdmin, isModerator, isBusinessAccount, toggleMenu, logout }
}
