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
  country?: string | null
  address?: string | null
}

/**
 * Подпись места для карточки свайпа: город, район и улица без дублей.
 *
 * Бэкенд отдаёт `address` как «улица · район · город» и только если
 * это разрешено приватностью. Город уже приходит отдельным полем,
 * поэтому убираем его из адреса. Если адрес скрыт, остаётся город
 * или страна — те же данные, что человек указал в анкете.
 *
 * @param card карточка с city/address/country
 * @returns «Минск · Чижовка · улица Корзюки» либо короткий fallback
 * @example
 * formatCardLocation({ city: 'Минск', address: 'улица Корзюки · Чижовка · Минск' })
 * // 'Минск · Чижовка · улица Корзюки'
 */
export function formatCardLocation(card: CardPlace): string {
  const city = String(card.city ?? '').trim()
  const country = String(card.country ?? '').trim()
  const address = String(card.address ?? '').trim()

  const rawParts = address === ''
    ? []
    : address.split(address.includes('·') ? '·' : ',')

  const ignored = [city, country]
    .map((part) => part.toLowerCase())
    .filter((part) => part !== '')

  const details: string[] = []

  for (const rawPart of rawParts) {
    const part = rawPart.trim()

    if (part === '') {
      continue
    }

    if (ignored.includes(part.toLowerCase())) {
      continue
    }

    if (!details.some((known) => known.toLowerCase() === part.toLowerCase())) {
      details.push(part)
    }
  }

  if (details.length === 0) {
    return formatPlace(city, country)
  }

  const detailParts = address.includes('·') ? [...details].reverse() : details
  const parts = city !== '' ? [city, ...detailParts] : detailParts

  return parts.join(' · ')
}
