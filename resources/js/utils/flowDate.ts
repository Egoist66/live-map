/**
 * Короткая дата для ленты UFlow: «только что», «5 мин», «вчера», дата.
 *
 * @param iso ISO-дата или null
 * @returns человекочитаемая строка
 */
export function formatFlowDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < minute) return 'только что'
  if (diffMs < hour) {
    const mins = Math.floor(diffMs / minute)
    return `${mins} мин. назад`
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `${hours} ч. назад`
  }
  if (diffMs < 2 * day) return 'вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}
