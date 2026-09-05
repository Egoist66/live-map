import { computed, onMounted, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useSettingsTabs } from '@/composables/useSettingsTabs'
import { useSupportExchange } from '@/composables/useSupportExchange'
import { useInvisible } from '@/composables/useInvisible'
import { useTheme } from '@/composables/useTheme'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useMyPinsSettings, useBillingInfo } from '@/composables/useSettingsPins'
import { useSupportForm, useSettingsBioPreview } from '@/composables/useSettingsSupport'
import { useHiddenFriends } from '@/composables/useHiddenFriends'
import { useAdminUsers } from '@/composables/useAdminUsers'
import { useAdminReports } from '@/composables/useAdminReports'
import { useLocationBlur } from '@/composables/useLocationBlur'

export function useSettingsPage(props: { user: any }) {
  const page = usePage()
  const u = computed(() => props.user || (page.props.auth as any).user)
  const { theme } = useTheme()
  const { active, tabs, activeIndex, menuModel, setActive, isAdmin } = useSettingsTabs()
  const pins = useMyPinsSettings(active)
  const { zoneCount, loadZoneCount } = useBillingInfo()
  const showAvatar = ref(false)
  const ex = useSupportExchange()
  const support = useSupportForm(u)
  const { bioPreviewText, bioPreviewEmpty } = useSettingsBioPreview(u)
  const avatarSrc = computed(() => avatarSrcFor(u.value))
  const invisible = useInvisible()
  const hidden = useHiddenFriends()
  const admin = useAdminUsers()
  const reports = useAdminReports()
  const blur = useLocationBlur()
  watch(active, (v) => { if (v === 'pins') pins.refetch(); if (v === 'support') ex.load(); if (v === 'billing') loadZoneCount(); if (v === 'privacy') hidden.load(); if (v === 'admin') reports.refresh() })
  onMounted(() => { loadZoneCount(); hidden.load() })
  return { u, theme, active, tabs, activeIndex, menuModel, setActive, isAdmin, zoneCount, showAvatar, ex, support, bioPreviewText, bioPreviewEmpty, avatarSrc, invisible, hidden, admin, reports, blur, ...pins }
}
