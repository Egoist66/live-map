import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useBadgeStore } from '@/stores/badges'
import { usePresence } from '@/composables/usePresence'
import { useNavigation } from '@/composables/useNavigation'
import { useAppNotifications } from '@/composables/useAppNotifications'
import { useBellNotifications } from '@/composables/useBellNotifications'
import { usePinActivity } from '@/composables/usePinActivity'
import { useAdminReports } from '@/composables/useAdminReports'

export function useAppLayout() {
  const badge = useBadgeStore()
  const presence = usePresence()
  const { user, avatarSrc, dashboardHref, settingsHref } = useNavigation()
  const appNotes = useAppNotifications()
  const bell = useBellNotifications()
  const pinActivity = usePinActivity()
  const adminReports = useAdminReports()
  const showDrawer = ref(false)
  const menu = ref()
  const menuItems = computed(() => [
    { label: user.value?.name || '', sublabel: user.value?.email || '', isHeader: true },
    { separator: true },
    { label: 'Профиль', icon: 'pi pi-user', accent: 'violet', active: route().current('dashboard'), command: () => router.visit(dashboardHref.value) },
    { label: 'Настройки', icon: 'pi pi-cog', accent: 'slate', active: route().current('profile.edit'), command: () => router.visit(settingsHref.value) },
    { label: 'Карта', icon: 'pi pi-map', accent: 'teal', active: route().current('map'), command: () => router.visit(route('map')) },
    { separator: true },
    { label: 'Выйти', icon: 'pi pi-sign-out', accent: 'red', danger: true, command: () => doLogout() },
  ])
  function toggleMenu(e: Event) { menu.value.toggle(e) }
  function closeDrawer() { showDrawer.value = false }
  async function doLogout() {
    try { presence.disconnect() } catch {}
    try {
      const { getSubscription } = await import('@/pwa/push.service')
      const { removePushSubscription } = await import('@/pwa/pwa.api')
      const sub = await getSubscription().catch(() => null)
      if (sub?.endpoint) await removePushSubscription(sub.endpoint).catch(() => {})
    } catch {}
    router.post(route('logout'))
  }
  function logout() { doLogout() }
  onMounted(() => { badge.init(); presence.connect(); appNotes.init(); pinActivity.init(); adminReports.init() })
  onBeforeUnmount(() => presence.disconnect())
  router.on('navigate', () => { presence.connect(); showDrawer.value = false })
  return { badge, presence, user, avatarSrc, dashboardHref, settingsHref, bell, pinActivity, adminReports, showDrawer, menu, menuItems, toggleMenu, closeDrawer, logout }
}
