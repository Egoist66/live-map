import { onUnmounted } from 'vue'
import { busEmit, busOn } from '@/services/realtime-bus'

/** Поля анкеты, которые разносим по профилям после сохранения. */
export const DATING_SYNC_FIELDS = [
  'dating_enabled',
  'dating_goal',
  'dating_custom_goal',
  'dating_about',
  'dating_interests',
  'dating_gender_pref',
  'dating_hide_name',
  'dating_hide_age',
  'dating_hide_distance',
  'dating_match_only',
] as const

/**
 * Мгновенно разнести сохранённую анкету по отображаемому профилю.
 *
 * Разрыв: `useDatingQuestionnaire.save()` пишет только в `auth.user`,
 * а `UloveProfileView` читает `props.profileUser / props.user` —
 * без перезагрузки страницы профиль показывал старое. Здесь патчим
 * целевой объект теми же полями сразу (мутация вложенных полей
 * реактивна), а следом страницы всё равно сверяются с сервером
 * через `router.reload`.
 *
 * @param target объект профиля (например, `props.profileUser`)
 * @param saved свежие поля из ответа PATCH /api/swipes/settings
 */
export function patchDatingFields(target: any, saved: Record<string, any> | null | undefined): void {
  if (!target || typeof target !== 'object' || !saved || typeof saved !== 'object') return

  for (const key of DATING_SYNC_FIELDS) {
    if (!(key in saved)) continue

    const value = (saved as Record<string, any>)[key]
    target[key] = key === 'dating_interests' && Array.isArray(value) ? [...value] : value
  }
}

/**
 * Подписаться на сохранение чужой/этой же анкеты и патчить профиль на месте.
 *
 * Для своего профиля событие прилетает из `useDatingQuestionnaire.save()`
 * в этой же вкладке — профиль обновляется синхронно, без ожидания
 * `router.reload`. Отписка — автоматически при размонтировании.
 *
 * @example
 * ```ts
 * useDatingSavedSync(() => props.profileUser)
 * ```
 *
 * @param target геттер объекта профиля для патчинга
 * @returns функция отписки (дополнительно к авто-отписке)
 */
export function useDatingSavedSync(target: () => any): () => void {
  const off = busOn('dating:questionnaire-saved', (saved) => {
    try {
      patchDatingFields(target(), saved)
    } catch {
      // Профиль уже размонтирован — игнорируем.
    }
  })

  onUnmounted(() => {
    try {
      off()
    } catch {
      // No-op.
    }
  })

  return off
}

/**
 * Оповестить все открытые профили о сохранённой анкете.
 *
 * @param saved свежие поля из ответа PATCH /api/swipes/settings
 */
export function emitDatingSaved(saved: Record<string, any> | null | undefined): void {
  if (!saved || typeof saved !== 'object') return
  busEmit('dating:questionnaire-saved', { ...saved })
}
