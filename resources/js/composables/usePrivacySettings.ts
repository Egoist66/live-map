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
