export const DONATE_OPTIONS = [2, 5, 10] as const

export function useDonate() {
  function formatByn(usd: number, rate: number | null): string {
    return rate ? (usd * rate).toFixed(2) + ' BYN' : '—'
  }
  return { options: DONATE_OPTIONS, formatByn }
}
