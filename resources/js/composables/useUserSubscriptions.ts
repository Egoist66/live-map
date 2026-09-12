import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { subscriptionsApi, type SubscriptionFlags } from '@/services/subscriptions.api'

/**
 * Подписка на обновления пользователя: новый пин, фото, репутация/уровень.
 * @param userId целевой пользователь
 * @param initial начальный статус с сервера (Inertia)
 * @returns состояние подписки и действия
 */
export function useUserSubscriptions(userId: number | string, initial?: { subscribed: boolean; notify_pin: boolean; notify_photo: boolean; notify_level: boolean; notify_post?: boolean }) {
  const subscribed = ref(!!initial?.subscribed)
  const notifyPin = ref(initial?.notify_pin ?? true)
  const notifyPhoto = ref(initial?.notify_photo ?? true)
  const notifyLevel = ref(initial?.notify_level ?? true)
  const notifyPost = ref(initial?.notify_post ?? true)
  const loading = ref(false)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  /**
   * Подтягивает статус с сервера.
   */
  async function refresh(): Promise<void> {
    try {
      const s = await subscriptionsApi.status(userId)
      subscribed.value = s.subscribed
      notifyPin.value = s.notify_pin
      notifyPhoto.value = s.notify_photo
      notifyLevel.value = s.notify_level
      notifyPost.value = s.notify_post ?? true
    } catch {}
  }

  /**
   * Переключает подписку. Доступно только для друзей.
   */
  async function toggle(): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      if (subscribed.value) {
        await subscriptionsApi.unsubscribe(userId)
        subscribed.value = false
        toast?.add({ severity: 'info', summary: 'Отписались', detail: 'Обновления больше не придут', life: 2500 })
      } else {
        const s = await subscriptionsApi.subscribe(userId, {
          notify_pin: notifyPin.value,
          notify_photo: notifyPhoto.value,
          notify_level: notifyLevel.value,
          notify_post: notifyPost.value,
        })
        subscribed.value = s.subscribed
        toast?.add({ severity: 'success', summary: 'Вы подписались на обновления пользователя', life: 3000 })
      }
    } catch (e: any) {
      const detail = e?.response?.data?.message || 'Попробуйте позже'
      toast?.add({ severity: 'error', summary: 'Не вышло', detail, life: 3000 })
    } finally {
      loading.value = false
    }
  }

  /**
   * Обновляет флаги типов уведомлений.
   * @param flags новые флаги
   */
  async function saveFlags(flags: SubscriptionFlags): Promise<void> {
    if (!subscribed.value || loading.value) return
    loading.value = true
    try {
      const s = await subscriptionsApi.subscribe(userId, flags)
      notifyPin.value = s.notify_pin
      notifyPhoto.value = s.notify_photo
      notifyLevel.value = s.notify_level
      notifyPost.value = s.notify_post ?? notifyPost.value
    } catch {} finally {
      loading.value = false
    }
  }

  return { subscribed, notifyPin, notifyPhoto, notifyLevel, notifyPost, loading, refresh, toggle, saveFlags }
}
