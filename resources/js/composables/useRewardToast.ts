import { useQuestStore } from '@/stores/quests'
import type { ActivityReward, WithReward } from '@/types/rewards'

/**
 * Тихое применение награды: только живое обновление шкалы ранга.
 *
 * Никаких тостов за действия — единственное уведомление о наградах
 * приходит раз в неделю в колокольчик (понедельничный итог).
 * Прогресс недели виден в табе «Задания → Система рейтинга».
 *
 * @example
 * const rewards = useRewardToast()
 * const res = await flowApi.toggleLike(postId)
 * rewards.applyReward(res)
 *
 * @returns применение награды из ответа API
 */
export function useRewardToast() {
  /**
   * Подменить рейтинг в сторе квестов свежим состоянием из награды.
   * Молча выходит, если награды нет (кап исчерпан, повтор или анлайк).
   * @param payload ответ API с опциональным полем reward
   */
  function applyReward(payload: unknown): void {
    const reward = (payload as WithReward | null | undefined)?.reward as ActivityReward | null | undefined

    if (!reward || reward.awarded <= 0) {
      return
    }

    patchRating(reward)
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
      // стор недоступен — очки всё равно начислены на бэке
    }
  }

  return { applyReward }
}
