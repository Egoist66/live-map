import { computed } from 'vue'

export type PrivacyValue = 'everyone' | 'friends' | 'none'

/**
 * Опции приватности личных сообщений чата.
 *
 * Единственный контроллер того, кто может писать:
 * `everyone` — все, `friends` — только друзья, `none` — никто.
 */
export const PRIVACY_OPTIONS = [
  { label: 'Все могут писать', value: 'everyone' as PrivacyValue, icon: 'pi pi-globe' },
  { label: 'Только друзья', value: 'friends' as PrivacyValue, icon: 'pi pi-users' },
  { label: 'Никто', value: 'none' as PrivacyValue, icon: 'pi pi-lock' },
]

/**
 * Значение приватности ULove-режима (чистый ulove без upin/uflow).
 *
 * `everyone` — пишут все со свайпов, `matches` — только взаимные мэтчи.
 */
export type UlovePrivacyValue = 'everyone' | 'matches'

/**
 * Опции приватности для чистого ULove-режима.
 *
 * Никаких отсылок к друзьям, карте, пинам и UFlow —
 * только «все со свайпов» либо «только мэтчи».
 */
export const ULOVE_PRIVACY_OPTIONS = [
  { label: 'Все со свайпов могут писать', value: 'everyone' as UlovePrivacyValue, icon: 'pi pi-globe' },
  { label: 'Только мэтчи', value: 'matches' as UlovePrivacyValue, icon: 'pi pi-heart-fill' },
]

/**
 * Маппит флаг dating_match_only в значение селекта ULove.
 *
 * @param flag значение dating_match_only с бэка
 * @returns matches если только мэтчи, иначе everyone
 */
export function uloveValueFromFlag(flag: unknown): UlovePrivacyValue {
  return flag ? 'matches' : 'everyone'
}

/**
 * Маппит значение селекта ULove во флаг dating_match_only.
 *
 * @param value значение селекта
 * @returns true если выбраны только мэтчи
 */
export function uloveFlagFromValue(value: string): boolean {
  return value === 'matches'
}

/**
 * Короткий лейбл приватности ULove для компактных мест.
 *
 * @param v значение ulove-приватности
 */
export function getUlovePrivacyShortLabel(v: string) {
  return v === 'matches' ? 'Мэтчи' : 'Все'
}

/**
 * Короткий лейбл приватности для компактных мест.
 *
 * @param v значение message_privacy
 */
export function getPrivacyShortLabel(v: string) {
  return v === 'everyone' ? 'Все' : v === 'friends' ? 'Друзья' : 'Никто'
}

/**
 * Хук приватности чата (только дропдаун message_privacy).
 *
 * @param privacy объект `{ message_privacy }` из useChatPage
 */
export function usePrivacySettings(privacy: { message_privacy: string }) {
  const shortLabel = computed(() => getPrivacyShortLabel(privacy.message_privacy))

  function setPrivacy(v: string) {
    privacy.message_privacy = v
  }

  return { options: PRIVACY_OPTIONS, shortLabel, setPrivacy }
}
