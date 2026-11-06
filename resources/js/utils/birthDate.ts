export const BIRTH_DATE_DISPLAY_FORMAT = 'dd.mm.yy'
export const BIRTH_DATE_PLACEHOLDER = '12.07.1997'

export function parseBirthDate(v: unknown): Date | null {
  if (v === '' || v === undefined || v === null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  if (!s) return null
  let m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const y = Number(m[3])
    const dt = new Date(y, mo - 1, d)
    if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return dt
    return null
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const dt = new Date(y, mo - 1, d)
    if (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) return dt
    return null
  }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return new Date(t)
  return null
}

export function toIsoBirthDate(v: unknown): string | null {
  if (v === '' || v === undefined || v === null) return null
  const d = parseBirthDate(v)
  if (!d) return typeof v === 'string' ? v : v as any
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export function isValidBirthDate(v: unknown): boolean {
  const d = parseBirthDate(v)
  if (!d) return false
  const now = new Date()
  if (d >= now) return false
  if (d.getFullYear() < 1900) return false
  return true
}

/**
 * Максимальная дата рождения, при которой человеку исполнилось 18.
 *
 * Считается как «сегодня минус 18 лет». Годится для max-date
 * пикера в регистрационной форме и гейта возраста.
 *
 * @returns Date для max-date DatePicker
 */
export function adultMaxBirthDate(): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d
}

/**
 * Проверка совершеннолетия по дате рождения.
 *
 * Валидная дата обязана, иначе false. Совершеннолетие считаем так же,
 * как бэкенд: 18-летие наступило не позже сегодня (год + 18 <= сейчас).
 *
 * @param v значение из формы (ISO-строка «YYYY-MM-DD», дд.мм.гггг или Date)
 * @returns true, когда дата валидна и человеку уже есть 18
 */
export function isAdultBirthDate(v: unknown): boolean {
  const d = parseBirthDate(v)
  if (!d || !isValidBirthDate(d)) return false
  const adult = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate())
  return adult.getTime() <= Date.now()
}
