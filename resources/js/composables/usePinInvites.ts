import { ref } from 'vue'
import { pinInvitesApi } from '@/services/pinInvites.api'

/**
 * Приглашения посмотреть пин вне зоны/страны.
 *
 * Автор пина может пригласить пользователя — тогда страна
 * и домашняя зона не блокируют просмотр этого пина.
 *
 * @example
 * const { invites, inviteUser } = usePinInvites(pinId)
 * await inviteUser(friendId)
 */
export function usePinInvites(pinId: number) {
  const invites = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      invites.value = await pinInvitesApi.list(pinId)
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось загрузить приглашения'
    } finally {
      loading.value = false
    }
  }

  /**
   * Пригласить пользователя смотреть пин.
   *
   * @param userId id приглашаемого
   */
  async function inviteUser(userId: number): Promise<void> {
    error.value = null
    try {
      const created = await pinInvitesApi.invite(pinId, userId)
      const exists = invites.value.some((i) => Number(i.id) === Number(created.id))
      if (!exists) {
        invites.value.unshift(created)
      }
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось пригласить'
      throw e
    }
  }

  /**
   * Отозвать приглашение.
   *
   * @param inviteId id приглашения
   */
  async function revokeInvite(inviteId: number): Promise<void> {
    error.value = null
    try {
      await pinInvitesApi.revoke(pinId, inviteId)
      invites.value = invites.value.filter((i) => Number(i.id) !== Number(inviteId))
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось отозвать'
      throw e
    }
  }

  return { invites, loading, error, load, inviteUser, revokeInvite }
}
