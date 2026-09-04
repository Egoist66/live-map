import { computed, onMounted, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useSettingsTabs } from '@/composables/useSettingsTabs'
import { useSupportExchange } from '@/composables/useSupportExchange'
import { useInvisible } from '@/composables/useInvisible'
import { useTheme } from '@/composables/useTheme'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useMyPinsSettings, useBillingInfo } from '@/composables/useSettingsPins'
import { useSupportForm, useSettingsBioPreview } from '@/composables/useSettingsSupport'

export function useSettingsPage(props: { user: any }) {
  const page = usePage()
  const u = computed(() => props.user || (page.props.auth as any).user)
  const { theme } = useTheme()
  const { active, tabs, activeIndex, menuModel, setActive } = useSettingsTabs()
  const pins = useMyPinsSettings(active)
  const { zoneCount, loadZoneCount } = useBillingInfo()
  const showAvatar = ref(false)
  const ex = useSupportExchange()
  const support = useSupportForm(u)
  const { bioPreviewText, bioPreviewEmpty } = useSettingsBioPreview(u)
  const avatarSrc = computed(() => avatarSrcFor(u.value))
  const invisible = useInvisible()
  watch(active, (v) => { if (v === 'pins') pins.refetch(); if (v === 'support') ex.load(); if (v === 'billing') loadZoneCount() })
  onMounted(loadZoneCount)
  return { u, theme, active, tabs, activeIndex, menuModel, setActive, zoneCount, showAvatar, ex, support, bioPreviewText, bioPreviewEmpty, avatarSrc, invisible, ...pins }
}
