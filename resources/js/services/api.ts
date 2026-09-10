import axios from 'axios'

export const api = axios.create({
  headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
  withCredentials: true,
  timeout: 20000,
})

api.interceptors.request.use((c) => {
  const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
  if (token && c.headers) c.headers['X-CSRF-TOKEN'] = token
  try {
    const sid = (window as any).Echo?.socketId?.()
    if (sid && c.headers) c.headers['X-Socket-ID'] = sid
  } catch {}
  return c
})
