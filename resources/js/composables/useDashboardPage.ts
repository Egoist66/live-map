import { computed, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import { openAdminPanel } from '@/composables/useAdminTabs'
import { useAdminClientGate } from '@/composables/useAdminClientGate'
import { useBadgeStore } from '@/stores/badges'
import { useSeo } from '@/composables/useSeo'
import { useProfileShare } from '@/composables/useProfileShare'
import { useInvisible } from '@/composables/useInvisible'
import { avatarSrcFor } from '@/composables/useAvatar'

const LEVEL_LABEL: Record<string, string> = { novice: 'Новичок', explorer: 'Исследователь', active: 'Активист', local: 'Свой в городе', veteran: 'Ветеран', legend: 'Легенда', guide: 'Гид' }
const LEVEL_COLOR: Record<string, string> = { novice: '!bg-stone-100 !text-stone-700 !border-stone-200', explorer: '!bg-sky-50 !text-sky-700 !border-sky-200', active: '!bg-cyan-50 !text-cyan-700 !border-cyan-200', local: '!bg-emerald-50 !text-emerald-700 !border-emerald-200', veteran: '!bg-violet-50 !text-violet-700 !border-violet-200', legend: '!bg-fuchsia-50 !text-fuchsia-700 !border-fuchsia-200', guide: '!bg-amber-50 !text-amber-700 !border-amber-200' }
const PLAN_LABEL: Record<string, string> = { free: 'Free', pro: 'Pro', premium: 'Premium', business: 'Business' }
const PLAN_COLOR: Record<string, string> = { free: '!bg-stone-100 !text-stone-700 !border-stone-200', pro: '!bg-gradient-to-br !from-violet-600 !to-indigo-600 !text-white !border-transparent', premium: '!bg-gradient-to-br !from-amber-500 !to-orange-600 !text-white !border-transparent', business: '!bg-ink-900 !text-white !border-ink-900' }

/**
 * Состояние страницы Dashboard (свой профиль).
 *
 * Принимает пользователя геттером, а не значением: Inertia при
 * `router.reload({ only: ['user'] })` заменяет объект пропса новым,
 * захваченное значение навсегда осталось бы старым и анкета после
 * сохранения (в т.ч. из готового шаблона) требовала бы F5.
 *
 * @param propsUser пользователь из пропсов или геттер на него
 * @param propsIsOwn флаг владения профилем
 */
export function useDashboardPage(propsUser?: any | (() => any), propsIsOwn?: boolean) {
  const seo = useSeo({ title: 'Профиль', description: 'Профиль ULove', noindex: true })
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user ?? null)
  const propsSnapshot = computed(() => (typeof propsUser === 'function' ? propsUser() : propsUser) ?? null)
  const u = computed(() => propsSnapshot.value || authUser.value)
  const auth = authUser
  const isGuest = computed(() => !u.value)
  const isOwn = computed(() => propsIsOwn ?? (u.value != null && authUser.value != null && u.value.id === authUser.value.id))
  const showAvatar = ref(false)
  const avatarSrc = computed(() => avatarSrcFor(u.value))
  const bioText = computed(() => (u.value?.bio || '').trim())
  const bioEmpty = computed(() => bioText.value.length === 0)
  const settingsHref = computed(() => {
    return route('profile.edit')
  })
  const badges = useBadgeStore()
  const { shareProfile, sharing } = useProfileShare()
  const invisible = useInvisible()
  const isAdmin = computed(() => !!authUser.value?.is_admin || authUser.value?.role === 'admin')
  const { isAdminBlocked } = useAdminClientGate()
  /** Кнопка «Панель модерации»: staff и только браузер (не Telegram/WebView). */
  const showAdminPanelLink = computed(() => isAdmin.value && !isAdminBlocked.value)
  const presence = computed(() => (invisible.isInvisible.value
    ? { active: false, label: 'скрыт · невидимка' }
    : { active: true, label: 'в сети' }))
  function openAvatar() { showAvatar.value = true }
  function closeAvatar() { showAvatar.value = false }
  function goMap() { router.visit('/map') }
  function goChat() { router.visit('/chat') }
  function goSettings() { router.visit(settingsHref.value) }
  /**
   * Открыть панель модерации в отдельной вкладке браузера.
   *
   * Текущий профиль остаётся нетронутым — консоль живёт своей жизнью.
   * В Telegram/WebView — no-op (кнопка там скрыта, бэк режет 403).
   */
  function goAdmin(): void {
    if (isAdminBlocked.value) return
    openAdminPanel()
  }
  function goFaq() { router.visit('/faq') }
  function share() { shareProfile({ id: u.value.id, profile_slug: u.value.profile_slug, name: u.value.name }) }
  const levelName = computed(() => LEVEL_LABEL[u.value?.level] || u.value?.level || 'Новичок')
  const registeredAt = computed(() => {
    try { return new Date(u.value.created_at).toLocaleDateString('ru-RU') } catch { return '' }
  })
  /**
   * Увести гостя на логин при протухшем SPA-состоянии.
   *
   * Свежий визит сервер уже редиректит сам (auth-middleware),
   * это страховка клиента: логаут в другой вкладке + возврат
   * на смонтированный Dashboard без пользователя.
   */
  function ensureAuth(): void {
    if (u.value) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    try {
      router.visit('/login', { replace: true })
    } catch {
    }
  }
  onMounted(() => {
    ensureAuth()

    if (!u.value) {
      return
    }

    if (isOwn.value) badges.init()
  })
  return { seo, auth, u, isGuest, isOwn, isAdmin, showAdminPanelLink, showAvatar, avatarSrc, bioText, bioEmpty, settingsHref, sharing, presence, ensureAuth, levelLabel: LEVEL_LABEL, levelColor: LEVEL_COLOR, planLabel: PLAN_LABEL, planColor: PLAN_COLOR, levelName, registeredAt, openAvatar, closeAvatar, goMap, goChat, goSettings, goAdmin, goFaq, share }
}
