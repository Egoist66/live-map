import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMounted } from '@vueuse/core'
import { usePresenceState, isRecentlySeen } from '@/composables/usePresence'
import { useUserProfile } from '@/composables/useUserProfile'
import { useProfileShare } from '@/composables/useProfileShare'
import { formatRelative } from '@/utils/date'
import { avatarSrcFor } from '@/composables/useAvatar'
import { useCachedImageSrc } from '@/composables/useImageBlobCache'
import { busOn } from '@/services/realtime-bus'
import { currentAuthUid } from '@/composables/useAuthUid'
import { loadCachedProfile, saveProfileSnapshot } from '@/composables/useGalleryCache'

const LEVEL_LABEL: Record<string, string> = { novice: 'Новичок', explorer: 'Исследователь', active: 'Активист', local: 'Свой в городе', veteran: 'Ветеран', legend: 'Легенда', guide: 'Гид' }

export function useProfileShowPage(props: { profileUser: any; isOwn: boolean; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null }) {
  /**
   * Точечные правки шапки из realtime (`user:profile.updated`): имя/аватар
   * просматриваемого пользователя обновляются без перезагрузки. Пустые
   * поля props не затираем — оверрайд ложится поверх.
   */
  const headerOverride = ref<Record<string, unknown>>({})
  const mergedUser = computed(() => ({ ...props.profileUser, ...headerOverride.value }))
  // placeholder = исходный URL на момент setup: SSR и первая клиентская
  // отрисовка совпадают (гидрация без mismatch), дальше заменяется blob'ом.
  const { src: avatarSrc } = useCachedImageSrc(
    () => avatarSrcFor(mergedUser.value),
    avatarSrcFor(mergedUser.value),
  )
  const profile = useUserProfile(props.profileUser.id)
  const showAvatar = ref(false)
  const bioText = computed(() => (props.profileUser.bio || '').trim())
  const bioEmpty = computed(() => bioText.value.length === 0)
  const isFriend = ref(props.isFriend)
  const isPending = ref(props.isPending)
  const isBlocked = ref(!!props.isBlocked)
  const isBlockedBy = ref(!!props.isBlockedBy)
  const canMessage = ref(props.canMessage)
  const reason = ref(props.canMessageReason)
  const confirm = ref<{ title: string; msg: string; action: () => Promise<void> } | null>(null)
  const isLocked = computed(() => isBlockedBy.value)
  const { isOnline: presenceOnline } = usePresenceState()
  /**
   * Своя анкета с активной невидимкой: вместо «в сети» показываем
   * режим — владелец должен видеть, что его никто не видит онлайн.
   * Бэк уже отдаёт `is_invisible` эффективным (настройка + тариф).
   */
  const invisibleActive = computed(() => props.isOwn && !!props.profileUser?.is_invisible)
  const online = computed(() => {
    if (invisibleActive.value) return false
    if (!props.isOwn && props.profileUser?.is_invisible) return false
    if (presenceOnline(props.profileUser.id)) return true
    return isRecentlySeen(props.profileUser?.last_seen_at)
  })
  const { shareProfile, sharing } = useProfileShare()
  /**
   * Флаг гидрации: на сервере и первой отрисовке клиента — false.
   * Относительное время («5 минут назад») зависит от Date.now(),
   * поэтому рендерим его только после mount — иначе SSR и клиент
   * расходятся на границе минуты и Vue ругается hydration mismatch.
   */
  const mounted = useMounted()
  const lastSeenText = computed(() => {
    if (invisibleActive.value) return '🕵️ невидимка'
    if (online.value) return 'в сети'
    if (!mounted.value) return 'оффлайн'
    const v = props.profileUser.last_seen_at
    if (!v) return 'оффлайн'
    try { return formatRelative(v) } catch { return 'оффлайн' }
  })
  const registeredAt = computed(() => {
    try { return new Date(props.profileUser.created_at).toLocaleDateString('ru-RU') } catch { return '' }
  })
  /**
   * Подпись домашней точки в инфо-блоке профиля.
   *
   * Показываем только город: улица/район — служебная точность для
   * дистанций свайпов, чужой точный адрес в профиле показывать не
   * стоит. Сохранена прежняя логика блюра и фолбэка по координатам.
   */
  const homeLabel = computed(() => {
    const u = props.profileUser
    if (!u) return ''
    if (u.home_lat == null || u.home_lng == null) return ''
    if (u.home_city) {
      return u.home_is_blurred ? `${u.home_city} (~${u.home_blur_label || 'скрыто'})` : u.home_city
    }
    return `${Number(u.home_lat).toFixed(4)}, ${Number(u.home_lng).toFixed(4)}`
  })
  const hasHome = computed(() => !!homeLabel.value)
  async function sync() {
    isFriend.value = profile.isFriend.value
    isPending.value = profile.isPending.value
    isBlocked.value = profile.isBlocked.value
    isBlockedBy.value = profile.isBlockedBy.value
    canMessage.value = profile.canMessage.value
    reason.value = profile.reason.value
  }
  async function onAdd() { await profile.addFriend(); await sync() }
  async function onRemove() { await profile.removeFriend(); await sync() }
  async function onBlock() { await profile.block(); await sync() }
  async function onUnblock() { await profile.unblock(); await sync() }
  async function onChat() { await profile.startChat() }
  function askRemove() { confirm.value = { title: 'Удалить из друзей?', msg: `Удалить ${props.profileUser.name} из друзей?`, action: onRemove } }
  function askBlock() { confirm.value = { title: 'Заблокировать?', msg: `Заблокировать ${props.profileUser.name}?`, action: onBlock } }
  function closeConfirm() { confirm.value = null }
  async function runConfirm() { const a = confirm.value?.action; confirm.value = null; if (a) await a() }
  function share() { shareProfile({ id: props.profileUser.id, profile_slug: props.profileUser.profile_slug, name: props.profileUser.name }) }

  let profileBusOff: (() => void) | null = null

  /**
   * Кеш шапки профиля: сначала отдаём снапшот из IndexedDB (мгновенный
   * рендер до гидрации/ответа), затем сохраняем актуальный. Плюс подписка
   * на realtime-правки профиля — аватар/имя просматриваемого не протухают.
   */
  onMounted(() => {
    const ownerId = Number(props.profileUser?.id ?? 0)
    const uid = currentAuthUid()
    if (!(ownerId > 0) || !(uid > 0)) return
    void (async () => {
      try {
        const cached = await loadCachedProfile(uid, ownerId)
        if (cached) {
          for (const key of ['name', 'avatar_url', 'profile_slug', 'last_seen_at']) {
            const fresh = (props.profileUser as any)?.[key]
            const remembered = (cached as any)?.[key]
            if ((fresh == null || fresh === '') && remembered != null && remembered !== '') {
              headerOverride.value[key] = remembered
            }
          }
        }
      } catch {}
      void saveProfileSnapshot(uid, ownerId, {
        id: ownerId,
        name: props.profileUser?.name ?? null,
        avatar_url: props.profileUser?.avatar_url ?? null,
        profile_slug: props.profileUser?.profile_slug ?? null,
        last_seen_at: props.profileUser?.last_seen_at ?? null,
      })
    })()
    try {
      profileBusOff = busOn('user:profile.updated', (e: any) => {
        const changedId = Number(e?.user_id ?? 0)
        if (!(changedId > 0) || changedId !== ownerId) return
        if (typeof e?.name === 'string' && e.name.trim() !== '') {
          headerOverride.value.name = e.name.trim()
        }
        if (Object.prototype.hasOwnProperty.call(e ?? {}, 'avatar_url')) {
          headerOverride.value.avatar_url = e.avatar_url ?? null
        }
        void saveProfileSnapshot(uid, ownerId, { id: ownerId, ...headerOverride.value })
      })
    } catch {}
  })

  onBeforeUnmount(() => {
    try {
      profileBusOff?.()
    } catch {}
    profileBusOff = null
  })

  return { avatarSrc, profile, showAvatar, bioText, bioEmpty, isFriend, isPending, isBlocked, isBlockedBy, canMessage, reason, confirm, isLocked, online, invisibleActive, sharing, lastSeenText, registeredAt, homeLabel, hasHome, levelLabel: LEVEL_LABEL, sync, onAdd, onRemove, onBlock, onUnblock, onChat, askRemove, askBlock, closeConfirm, runConfirm, share }
}
