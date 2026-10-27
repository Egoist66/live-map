/**
 * Подпись места из анкеты для свайпов.
 *
 * Город — основной ориентир, страна — резерв: если человек не указал
 * город, показываем хотя бы страну, а не пустую строку.
 *
 * @param city город из анкеты
 * @param country страна из анкеты
 * @returns «Минск · Беларусь», «Беларусь» либо пустая строка
 * @example
 * formatPlace('Минск', 'Беларусь') // 'Минск · Беларусь'
 */
export function formatPlace(city?: string | null, country?: string | null): string {
  const cityName = String(city ?? '').trim()
  const countryName = String(country ?? '').trim()

  if (cityName !== '') {
    return countryName !== '' && countryName !== cityName
      ? `${cityName} · ${countryName}`
      : cityName
  }

  return countryName
}

/** Минимальные поля карточки, нужные для подписи места. */
export interface CardPlace {
  city?: string | null
  district?: string | null
  country?: string | null
}

/**
 * Подпись места для карточки свайпа: только город и район.
 *
 * Улицу намеренно не показываем — она остаётся на бэкенде для точных
 * расчётов. Если района нет или он скрыт приватностью, остаётся город,
 * а при отсутствии города — страна.
 *
 * @param card карточка с city/district/country
 * @returns «Минск · Чижовка» либо короткий fallback
 * @example
 * formatCardLocation({ city: 'Минск', district: 'Чижовка' })
 * // 'Минск · Чижовка'
 */
export function formatCardLocation(card: CardPlace): string {
  const city = String(card.city ?? '').trim()
  const district = String(card.district ?? '').trim()
  const country = String(card.country ?? '').trim()

  const parts: string[] = []

  if (city !== '') {
    parts.push(city)
  }

  const cityKey = city.toLowerCase()
  const districtKey = district.toLowerCase()

  if (district !== '' && districtKey !== cityKey) {
    parts.push(district)
  }

  if (parts.length > 0) {
    return parts.join(' · ')
  }

  return formatPlace(city, country)
}
