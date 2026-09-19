import { useToast } from 'primevue/usetoast'
import { useQuestStore } from '@/stores/quests'
import type { ActivityReward, WithReward } from '@/types/rewards'

/**
 * Показ награды за активность: тост +N и живое обновление шкалы ранга.
 *
 * Бэк присылает `reward` в ответах на действия (пост, лайк, свайп…).
 * Стор квестов патчится свежим `rating` из ответа — ранг растёт
 * сразу, без перезагрузки. Повышение ранга — отдельным тостом.
 *
 * @example
 * const rewards = useRewardToast()
 * const res = await flowApi.toggleLike(postId)
 * rewards.applyReward(res)
 *
 * @returns применение награды из ответа API
 */
export function useRewardToast() {
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /**
   * Показать награду из ответа API и обновить ранг в сторе.
   * Молча выходит, если награды нет (кап исчерпан или анлайк).
   * @param payload ответ API с опциональным полем reward
   */
  function applyReward(payload: unknown): void {
    const reward = (payload as WithReward | null | undefined)?.reward as ActivityReward | null | undefined

    if (!reward || reward.awarded <= 0) {
      return
    }

    patchRating(reward)

    if (reward.leveled_up) {
      toast?.add({
        severity: 'success',
        summary: `Новый ранг: ${reward.level_name}!`,
        detail: `+${reward.awarded} ★ · всего ${reward.score}`,
        life: 5000,
      })
      return
    }

    toast?.add({
      severity: 'success',
      summary: `+${reward.awarded} ★`,
      detail: `Ранг растёт: всего ${reward.score}`,
      life: 2500,
    })
  }

  /**
   * Подменить рейтинг в сторе квестов свежим состоянием из награды.
   * @param reward награда из ответа API
   */
  function patchRating(reward: ActivityReward): void {
    try {
      const store = useQuestStore()

      if (store.state && reward.rating) {
        store.state = { ...store.state, rating: reward.rating as never }
      }
    } catch {
      // стор недоступен — тоста достаточно
    }
  }

  return { applyReward }
}
