import axios from 'axios'

export const api = axios.create({
  headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((c) => {
  const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
  if (token && c.headers) c.headers['X-CSRF-TOKEN'] = token
  return c
})
