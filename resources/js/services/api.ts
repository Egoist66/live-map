import axios from 'axios'
import { getStoredTokenSync } from '@/composables/useAuthStorage'
import { nativeClientHeader } from '@/composables/useNativeClient'
import { isTelegramWebView } from '@/composables/useTelegram'

const apiBaseUrl = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: apiBaseUrl || undefined,
  headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
  withCredentials: true,
  // Laravel отдаёт XSRF-TOKEN куку на web-роутах: axios сам положит её
  // в X-XSRF-TOKEN. Без этого POST /api/telegram/auth умирал в 419,
  // т.к. meta csrf-token в layout раньше отсутствовала.
  withXSRFToken: true,
  timeout: 20000,
})

api.interceptors.request.use((c) => {
  const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
  if (token && c.headers) c.headers['X-CSRF-TOKEN'] = token
  const bearer = getStoredTokenSync()
  if (bearer && c.headers && !c.headers['Authorization']) c.headers['Authorization'] = `Bearer ${bearer}`
  if (c.headers && !c.headers['X-UPin-Client']) {
    const tgHeader = isTelegramWebView() ? 'telegram-webapp' : null
    c.headers['X-UPin-Client'] = tgHeader ?? nativeClientHeader()
  }
  try {
    const sid = (window as any).Echo?.socketId?.()
    if (sid && c.headers) c.headers['X-Socket-ID'] = sid
  } catch {}
  return c
})
