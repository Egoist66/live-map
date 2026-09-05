import { ref } from 'vue'
import { api } from '@/services/api'

export function useSupportExchange() {
  const usdRate = ref<number | null>(null)
  const loading = ref(false)

  async function load() {
    if (usdRate.value) return
    loading.value = true
    try {
      const { data } = await api.get('/api/nbrb/rates/USD', { params: { parammode: 2 } })
      if (data?.Cur_OfficialRate) usdRate.value = data.Cur_OfficialRate / data.Cur_Scale
    } catch {
      try {
        const r = await fetch('https://api.nbrb.by/exrates/rates/USD?parammode=2')
        const d: any = await r.json()
        if (d?.Cur_OfficialRate) usdRate.value = d.Cur_OfficialRate / d.Cur_Scale
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
