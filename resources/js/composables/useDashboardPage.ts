import { computed, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { useBadgeStore } from '@/stores/badges'
import { useSeo } from '@/composables/useSeo'
import { useProfileShare } from '@/composables/useProfileShare'
import { useInvisible } from '@/composables/useInvisible'
import { avatarSrcFor } from '@/composables/useAvatar'

const LEVEL_LABEL: Record<string, string> = { novice: 'Новичок', explorer: 'Исследователь', active: 'Активист', local: 'Свой в городе', veteran: 'Ветеран', legend: 'Легенда', guide: 'Гид' }
const LEVEL_COLOR: Record<string, string> = { novice: '!bg-stone-100 !text-stone-700 !border-stone-200', explorer: '!bg-sky-50 !text-sky-700 !border-sky-200', active: '!bg-cyan-50 !text-cyan-700 !border-cyan-200', local: '!bg-emerald-50 !text-emerald-700 !border-emerald-200', veteran: '!bg-violet-50 !text-violet-700 !border-violet-200', legend: '!bg-fuchsia-50 !text-fuchsia-700 !border-fuchsia-200', guide: '!bg-amber-50 !text-amber-700 !border-amber-200' }
const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', business: 'Business' }
const PLAN_COLOR: Record<string, string> = { free: '!bg-stone-100 !text-stone-700 !border-stone-200', pro: '!bg-gradient-to-br !from-violet-600 !to-indigo-600 !text-white !border-transparent', business: '!bg-ink-900 !text-white !border-ink-900' }

export function useDashboardPage(propsUser?: any, propsIsOwn?: boolean) {
  const seo = useSeo({ title: 'Профиль', description: 'Профиль UPin', noindex: true })
  const page = usePage()
  const auth = (page.props.auth as any).user
  const u = computed(() => propsUser || auth)
  const isOwn = computed(() => propsIsOwn ?? u.value.id === auth.id)
  const showAvatar = ref(false)
  const avatarSrc = computed(() => avatarSrcFor(u.value))
  const bioText = computed(() => (u.value.bio || '').trim())
  const bioEmpty = computed(() => bioText.value.length === 0)
  const settingsHref = computed(() => {
    return route('profile.edit')
  })
  const badges = useBadgeStore()
  const { shareProfile, sharing } = useProfileShare()
  const invisible = useInvisible()
  const isAdmin = computed(() => !!auth?.is_admin || auth?.role === 'admin')
  const presence = computed(() => (invisible.isInvisible.value
    ? { active: false, label: 'скрыт · невидимка' }
    : { active: true, label: 'в сети' }))
  function openAvatar() { showAvatar.value = true }
  function closeAvatar() { showAvatar.value = false }
  function goMap() { router.visit('/map') }
  function goChat() { router.visit('/chat') }
  function goSettings() { router.visit(settingsHref.value) }
  function goAdmin() { router.visit(route('admin')) }
  function goFaq() { router.visit('/faq') }
  function share() { shareProfile({ id: u.value.id, name: u.value.name }) }
  const levelName = computed(() => LEVEL_LABEL[u.value?.level] || u.value?.level || 'Новичок')
  const registeredAt = computed(() => {
    try { return new Date(u.value.created_at).toLocaleDateString('ru-RU') } catch { return '' }
  })
  onMounted(() => { if (isOwn.value) badges.init() })
  return { seo, auth, u, isOwn, isAdmin, showAvatar, avatarSrc, bioText, bioEmpty, settingsHref, sharing, presence, levelLabel: LEVEL_LABEL, levelColor: LEVEL_COLOR, planLabel: PLAN_LABEL, planColor: PLAN_COLOR, levelName, registeredAt, openAvatar, closeAvatar, goMap, goChat, goSettings, goAdmin, goFaq, share }
}
