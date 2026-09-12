import { computed, toValue, type MaybeRef } from 'vue'
import { useGender } from '@/composables/useGender'
import { ageLabel, calcAge } from '@/composables/useUserAge'

/**
 * Производные строки для плиток «Общей информации» профиля.
 *
 * Пустая строка означает «нет данных» — плитка скрывается.
 *
 * @param user пользователь (ref или геттер)
 * @returns возраст, пол и место проживания строками
 * @example
 * const tiles = useProfileInfoTiles(() => props.profileUser)
 */
export function useProfileInfoTiles(user: MaybeRef<any>) {
  const gender = useGender()

  const ageText = computed(() => {
    const current = toValue(user)
    const direct = current?.age != null ? ageLabel(Number(current.age)) : ''
    if (direct) return direct
    const fromBirth = calcAge(current?.birth_date)
    return fromBirth != null ? ageLabel(fromBirth) : ''
  })

  const genderLabel = computed(() => {
    const current = toValue(user)
    if (!current?.gender) return ''
    return gender.getLabel(current.gender)
  })

  const residenceText = computed(() => {
    const current = toValue(user)
    const parts = [current?.country, current?.home_city].filter(Boolean)
    if (parts.length) return parts.join(', ')
    return 'Не указан'
  })

  return { ageText, genderLabel, residenceText }
}
