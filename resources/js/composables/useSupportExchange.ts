import { ref } from 'vue'

export function useSupportExchange() {
  const usdRate = ref<number | null>(null)
  const loading = ref(false)

  async function load() {
    if (usdRate.value) return
    loading.value = true
    try {
      const r = await fetch('https://api.nbrb.by/exrates/rates/431?parammode=2')
      const d: any = await r.json()
      usdRate.value = d.Cur_OfficialRate / d.Cur_Scale
    } catch {
      try {
        const r2 = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
        const d2: any = await r2.json()
        usdRate.value = d2.rates?.BYN || null
      } catch {}
    } finally {
      loading.value = false
    }
  }

  function fmtByn(usd: number) {
    if (!usdRate.value) return '—'
    return (usd * usdRate.value).toFixed(2) + ' BYN'
  }

  return { usdRate, loading, load, fmtByn }
}
