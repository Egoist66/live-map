import type { PinGenderAudience } from '@/types/entities/Pin'

export const PIN_GENDER_AUDIENCE_OPTIONS: Array<{ label: string; value: PinGenderAudience; hint: string }> = [
  { label: 'Все', value: 'all', hint: 'Видят все' },
  { label: 'Только женщины', value: 'female', hint: 'Видят только женщины' },
  { label: 'Только мужчины', value: 'male', hint: 'Видят только мужчины' },
]

export function getPinAudienceLabel(v: string | null | undefined): string {
  return PIN_GENDER_AUDIENCE_OPTIONS.find((o) => o.value === v)?.label ?? 'Все'
}

export function normalizePinAudience(v: unknown): PinGenderAudience {
  return v === 'male' || v === 'female' ? v : 'all'
}

export function usePinAudience() {
  return { options: PIN_GENDER_AUDIENCE_OPTIONS, getLabel: getPinAudienceLabel, normalize: normalizePinAudience }
}
