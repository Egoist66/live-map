import { computed, type Ref } from 'vue'
import {
  PRIVACY_OPTIONS,
  ULOVE_PRIVACY_OPTIONS,
  getPrivacyShortLabel,
  getUlovePrivacyShortLabel,
  uloveFlagFromValue,
  uloveValueFromFlag,
} from '@/composables/usePrivacySettings'

/**
 * Состояние приватности чата (общее + ULove-флаг).
 */
export interface ChatPrivacyState {
  message_privacy: string
  dating_match_only?: boolean
}

/**
 * Приватность чата с учётом чистого ULove-режима.
 *
 * В uloveOnly нет друзей, карты и UFlow — селект показывает только
 * «Все со свайпов» / «Только мэтчи» (маппинг на dating_match_only).
 * В обычном режиме — классические everyone/friends/none (message_privacy).
 *
 * Компоненты только отображают `options`/`currentValue`/`shortLabel`
 * и зовут `applyValue()` — сохранение делает useChatPage.
 *
 * @param privacy реактивное состояние приватности из useChatPage
 * @param uloveOnly чистый ULove-режим (ulove без upin/uflow)
 * @returns опции, текущее значение, короткий лейбл и применение выбора
 * @example
 * const privacy = useChatPrivacy(ref({ message_privacy: 'everyone' }), uloveOnly)
 */
export function useChatPrivacy(
  privacy: Ref<ChatPrivacyState>,
  uloveOnly: Ref<boolean> | boolean,
) {
  const isUlove = computed(() =>
    typeof uloveOnly === 'boolean' ? uloveOnly : uloveOnly.value,
  )

  const options = computed(() =>
    isUlove.value ? ULOVE_PRIVACY_OPTIONS : PRIVACY_OPTIONS,
  )

  const currentValue = computed(() => {
    if (isUlove.value) {
      return uloveValueFromFlag(privacy.value.dating_match_only)
    }

    return privacy.value.message_privacy
  })

  const shortLabel = computed(() => {
    if (isUlove.value) {
      return getUlovePrivacyShortLabel(currentValue.value)
    }

    return getPrivacyShortLabel(privacy.value.message_privacy)
  })

  /**
   * Применяет выбор селекта к локальному состоянию.
   * Сохранение на сервер — в useChatPage.savePrivacy().
   *
   * @param value новое значение селекта
   */
  function applyValue(value: string): void {
    if (isUlove.value) {
      privacy.value.dating_match_only = uloveFlagFromValue(value)
      return
    }

    privacy.value.message_privacy = value
  }

  return { options, currentValue, shortLabel, applyValue }
}
