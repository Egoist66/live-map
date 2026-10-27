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
