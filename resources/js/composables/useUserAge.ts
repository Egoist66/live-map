import { computed } from 'vue'

export function calcAge(birthDate: string | Date | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate)
  if (Number.isNaN(d.getTime())) return null
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age < 0 ? null : age
}

export function ageLabel(age: number | null | undefined): string {
  if (age == null) return ''
  const mod10 = age % 10
  const mod100 = age % 100
  const word = mod10 === 1 && mod100 !== 11 ? 'год' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'года' : 'лет'
  return `${age} ${word}`
}

export function useUserAge(birthDate: () => string | Date | null | undefined) {
  const age = computed(() => calcAge(birthDate()))
  const label = computed(() => ageLabel(age.value))
  return { age, label, calcAge, ageLabel }
}
