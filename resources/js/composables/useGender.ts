export type GenderValue = 'male' | 'female' | 'other'

export const GENDER_OPTIONS = [
  { label: 'Мужчина', value: 'male' as GenderValue, icon: 'pi pi-user' },
  { label: 'Женщина', value: 'female' as GenderValue, icon: 'pi pi-user' },
  { label: 'Другой', value: 'other' as GenderValue, icon: 'pi pi-users' },
]

export function getGenderLabel(v: string | null | undefined) {
  if (!v) return 'Не указан'
  return GENDER_OPTIONS.find((o) => o.value === v)?.label ?? 'Не указан'
}

export function useGender() {
  return { options: GENDER_OPTIONS, getLabel: getGenderLabel }
}
