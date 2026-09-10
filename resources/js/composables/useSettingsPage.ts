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
import { useScreenLock } from '@/composables/useScreenLock'
import { useAdminUsers } from '@/composables/useAdminUsers'
import { useAdminReports } from '@/composables/useAdminReports'
import { useAdminImpersonate } from '@/composables/useAdminImpersonate'
import { useSecurityImpersonations } from '@/composables/useSecurityImpersonations'
import { useLocationBlur } from '@/composables/useLocationBlur'
import { usePhotoCommentsPrivacy } from '@/composables/usePhotoCommentsPrivacy'
import { useHomeRadiusSetting } from '@/composables/useHomeRadiusSetting'

export function useSettingsPage(props: { user: any }) {
  const page = usePage()
  const u = computed(() => props.user || (page.props.auth as any).user)
  const { theme } = useTheme()
  const { active, tabs, activeIndex, menuModel, setActive, isAdmin, showProcedures } = useSettingsTabs()
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
  const imp = useAdminImpersonate()
  const proc = useSecurityImpersonations(active)
  const blur = useLocationBlur()
  const homeRadius = useHomeRadiusSetting()
  const photoPrivacy = usePhotoCommentsPrivacy(() => String((u.value as any)?.photo_comments_privacy || 'everyone'))
  watch(u, (v) => photoPrivacy.sync(String((v as any)?.photo_comments_privacy || 'everyone')))
  const screenLock = useScreenLock()
  watch(active, (v) => { if (v === 'pins') pins.refetch(); if (v === 'support') ex.load(); if (v === 'billing') loadZoneCount(); if (v === 'privacy') hidden.load(); if (v === 'admin') reports.refresh(); if (v === 'procedures') { proc.load() } })
  onMounted(() => { loadZoneCount(); hidden.load(); proc.init() })
  return { u, theme, active, tabs, activeIndex, menuModel, setActive, isAdmin, showProcedures, zoneCount, showAvatar, ex, support, bioPreviewText, bioPreviewEmpty, avatarSrc, invisible, hidden, admin, reports, imp, proc, blur, homeRadius, photoPrivacy, screenLock, ...pins }
}
