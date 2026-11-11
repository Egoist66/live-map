import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { pipeApi } from '@/services/pipe.api'
import type { PipeProfile } from '@/types/pipe'

/**
 * Страница автора в Pipe: шапка профиля + кнопка подписки.
 *
 * Явные пропсы страницы (Inertia) дают быстрый первый кадр;
 * статус освежается с сервера при заходе (лайки/подписки растут).
 *
 * @param initial шапка из PipePageController::profile
 * @example
 * const profile = usePipeProfile(props.profile)
 */
export function usePipeProfile(initial: PipeProfile) {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  const profile = ref<PipeProfile>({ ...initial })
  const followBusy = ref(false)

  const me = computed(() => (usePage().props.auth as { user?: { id: number } }).user)
  const isGuest = computed(() => !me.value)

  /** Отписан/подписан текст кнопки. */
  const followButtonLabel = computed(() => {
    const isFollowing = profile.value.is_following
    return isFollowing ? 'Вы подписаны' : 'Подписаться'
  })

  /**
   * Свежий статус профиля (счётчики, флаг подписки).
   */
  async function refreshStatus(): Promise<void> {
    try {
      const fresh = await pipeApi.profileStatus(profile.value.id)
      profile.value = { ...profile.value, ...fresh }
    } catch { /* пропсы остаются — хуже не станет */ }
  }

  /**
   * Подписаться/отписаться на автора тредов.
   * Гость уводится на логин главного сайта — сессия общая.
   */
  async function toggleFollow(): Promise<void> {
    if (isGuest.value || profile.value.is_self || followBusy.value) return

    followBusy.value = true
    try {
      const res = await pipeApi.toggleFollow(profile.value.id)
      profile.value.is_following = res.following

      toast?.add({
        severity: 'success',
        summary: res.following ? 'Вы подписались' : 'Вы отписались',
        life: 2000,
      })
    } catch {
      toast?.add({ severity: 'error', summary: 'Ошибка', detail: 'Не вышло поменять подписку', life: 2500 })
    } finally {
      followBusy.value = false
    }
  }

  return { profile, followBusy, isGuest, followButtonLabel, refreshStatus, toggleFollow }
}
