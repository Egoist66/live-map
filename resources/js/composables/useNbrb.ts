import { computed, ref } from 'vue'
import { api } from '@/services/api'

export interface NbrbCurrency {
  Cur_ID: number
  Cur_Code: string
  Cur_Abbreviation: string
  Cur_Name: string
  Cur_QuotName: string
  Cur_Scale: number
  Cur_Periodicity: number
  Cur_DateStart: string
  Cur_DateEnd: string
}

export interface NbrbRate {
  Cur_ID: number
  Date: string
  Cur_Abbreviation: string
  Cur_Scale: number
  Cur_Name: string
  Cur_OfficialRate: number
}

export interface NbrbConvertResult {
  from: string
  cur_id: number
  cur_name: string
  cur_scale: number
  official_rate: number
  per_unit: number
  date: string
  amount: number
  byn: number
}

const POPULAR = ['USD', 'EUR', 'RUB', 'PLN', 'UAH', 'CNY']

export function useNbrb() {
  const currencies = ref<NbrbCurrency[]>([])
  const rates = ref<NbrbRate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const ondate = ref<string>(new Date().toISOString().slice(0, 10))
  const amount = ref<number>(5)
  const curCode = ref<string>('USD')
  const convertResult = ref<NbrbConvertResult | null>(null)
  const converting = ref(false)

  async function loadCurrencies() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get('/api/nbrb/currencies')
      const list: NbrbCurrency[] = Array.isArray(data) ? data : []
      const rank = (c: string) => {
        const i = POPULAR.indexOf(c)
        return i === -1 ? 99 : i
      }
      currencies.value = list
        .filter((c) => new Date(c.Cur_DateEnd) > new Date('2000-01-01') || !c.Cur_DateEnd)
        .sort((a, b) => rank(a.Cur_Abbreviation) - rank(b.Cur_Abbreviation) || a.Cur_Abbreviation.localeCompare(b.Cur_Abbreviation))
    } catch {
      error.value = 'Не удалось загрузить валюты НБРБ'
    } finally {
      loading.value = false
    }
  }

  async function loadRates(date?: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get('/api/nbrb/rates', { params: { periodicity: 0, ondate: date || ondate.value || undefined } })
      rates.value = Array.isArray(data) ? data : []
    } catch {
      error.value = 'Не удалось загрузить курсы НБРБ'
    } finally {
      loading.value = false
    }
  }

  async function convert(a?: number, from?: string, date?: string) {
    converting.value = true
    try {
      const { data } = await api.get('/api/nbrb/convert', {
        params: { amount: a ?? amount.value, from: from ?? curCode.value, ondate: date ?? ondate.value ?? undefined },
      })
      convertResult.value = data
      return data as NbrbConvertResult
    } finally {
      converting.value = false
    }
  }

  async function dynamics(curId: number, start: string, end: string) {
    const { data } = await api.get(`/api/nbrb/dynamics/${curId}`, { params: { startdate: start, enddate: end } })
    return data
  }

  const rateMap = computed(() => {
    const m = new Map<string, number>()
    for (const r of rates.value) m.set(r.Cur_Abbreviation, r.Cur_OfficialRate / r.Cur_Scale)
    if (convertResult.value) m.set(convertResult.value.from, convertResult.value.per_unit)
    return m
  })

  function perUnit(code: string): number | null {
    return rateMap.value.get(code.toUpperCase()) ?? null
  }

  function toByn(a: number, code: string): string {
    const r = perUnit(code)
    return r ? (a * r).toFixed(2) + ' BYN' : '—'
  }

  return { currencies, rates, loading, error, ondate, amount, curCode, convertResult, converting, loadCurrencies, loadRates, convert, dynamics, perUnit, toByn }
}
