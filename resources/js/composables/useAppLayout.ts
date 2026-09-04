import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useBadgeStore } from '@/stores/badges'
import { usePresence } from '@/composables/usePresence'
import { useNavigation } from '@/composables/useNavigation'
import { useAppNotifications } from '@/composables/useAppNotifications'
import { useBellNotifications } from '@/composables/useBellNotifications'

export function useAppLayout() {
  const badge = useBadgeStore()
  const presence = usePresence()
  const { user, avatarSrc, dashboardHref, settingsHref } = useNavigation()
  const appNotes = useAppNotifications()
  const bell = useBellNotifications()
  const showDrawer = ref(false)
  const menu = ref()
  const menuItems = computed(() => [
    { label: user.value?.name || '', sublabel: user.value?.email || '', isHeader: true },
    { separator: true },
    { label: 'Профиль', icon: 'pi pi-user', command: () => router.visit(dashboardHref.value) },
    { label: 'Настройки', icon: 'pi pi-cog', command: () => router.visit(settingsHref.value) },
    { label: 'Карта', icon: 'pi pi-map', command: () => router.visit(route('map')) },
    { separator: true },
    { label: 'Выйти', icon: 'pi pi-sign-out', command: () => doLogout() },
  ])
  function toggleMenu(e: Event) { menu.value.toggle(e) }
  function closeDrawer() { showDrawer.value = false }
  function doLogout() { try { presence.disconnect() } catch {} router.post(route('logout')) }
  function logout() { doLogout() }
  onMounted(() => { badge.init(); presence.connect(); appNotes.init() })
  onBeforeUnmount(() => presence.disconnect())
  router.on('navigate', () => { presence.connect(); showDrawer.value = false })
  return { badge, presence, user, avatarSrc, dashboardHref, settingsHref, bell, showDrawer, menu, menuItems, toggleMenu, closeDrawer, logout }
}
