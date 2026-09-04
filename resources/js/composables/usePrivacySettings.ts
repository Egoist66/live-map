import { computed } from 'vue'

export type PrivacyValue = 'everyone' | 'friends' | 'none'

export const PRIVACY_OPTIONS = [
  { label: 'Все могут писать', value: 'everyone' as PrivacyValue, icon: 'pi pi-globe' },
  { label: 'Только друзья', value: 'friends' as PrivacyValue, icon: 'pi pi-users' },
  { label: 'Никто', value: 'none' as PrivacyValue, icon: 'pi pi-lock' },
]

export function isRandomDisabledFor(v: string) {
  return v !== 'everyone'
}

export function getPrivacyShortLabel(v: string) {
  return v === 'everyone' ? 'Все' : v === 'friends' ? 'Друзья' : 'Никто'
}

export function usePrivacySettings(privacy: { message_privacy: string; allow_random_messages: boolean }) {
  const shortLabel = computed(() => getPrivacyShortLabel(privacy.message_privacy))
  const isRandomDisabled = computed(() => isRandomDisabledFor(privacy.message_privacy))

  function setPrivacy(v: string) {
    privacy.message_privacy = v
  }

  function setRandom(v: boolean) {
    privacy.allow_random_messages = v
  }

  return { options: PRIVACY_OPTIONS, shortLabel, isRandomDisabled, setPrivacy, setRandom }
}
