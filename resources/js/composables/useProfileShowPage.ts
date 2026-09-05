import { computed, ref } from 'vue'
import { usePresenceState } from '@/composables/usePresence'
import { useUserProfile } from '@/composables/useUserProfile'
import { useProfileShare } from '@/composables/useProfileShare'
import { formatRelative } from '@/utils/date'
import { avatarSrcFor } from '@/composables/useAvatar'

const LEVEL_LABEL: Record<string, string> = { novice: 'Новичок', local: 'Местный', guide: 'Гид района', explorer: 'Исследователь', veteran: 'Ветеран' }

export function useProfileShowPage(props: { profileUser: any; isOwn: boolean; isFriend: boolean; isPending: boolean; isBlocked?: boolean; isBlockedBy?: boolean; canMessage: boolean; canMessageReason: string | null }) {
  const avatarSrc = computed(() => avatarSrcFor(props.profileUser))
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
  const { isOnline } = usePresenceState()
  const online = computed(() => {
    if (!props.isOwn && props.profileUser?.is_invisible) return false
    return isOnline(props.profileUser.id)
  })
  const { shareProfile, sharing } = useProfileShare()
  const lastSeenText = computed(() => {
    if (online.value) return 'в сети'
    const v = props.profileUser.last_seen_at
    if (!v) return 'оффлайн'
    try { return formatRelative(v) } catch { return 'оффлайн' }
  })
  const registeredAt = computed(() => {
    try { return new Date(props.profileUser.created_at).toLocaleDateString('ru-RU') } catch { return '' }
  })
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
  function share() { shareProfile({ id: props.profileUser.id, name: props.profileUser.name }) }
  return { avatarSrc, profile, showAvatar, bioText, bioEmpty, isFriend, isPending, isBlocked, isBlockedBy, canMessage, reason, confirm, isLocked, online, sharing, lastSeenText, registeredAt, levelLabel: LEVEL_LABEL, sync, onAdd, onRemove, onBlock, onUnblock, onChat, askRemove, askBlock, closeConfirm, runConfirm, share }
}
