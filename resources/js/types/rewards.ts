/**
 * Награда за активность: бэк присылает в ответах на действия.
 */

/** Пейлоад награды из API (см. App\Services\ActivityRewards). */
export type ActivityReward = {
  awarded: number
  action: string
  score: number
  level: string
  level_name: string
  leveled_up: boolean
  rating: unknown
}

/** Любой ответ API, к которому бэк может приложить награду. */
export type WithReward = {
  reward?: ActivityReward | null
}
