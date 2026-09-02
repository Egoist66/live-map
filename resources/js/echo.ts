import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
// @ts-ignore
window.Pusher = Pusher
Pusher.logToConsole = false
const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http'
const rawKey = import.meta.env.VITE_REVERB_APP_KEY
// @ts-ignore
window.Echo = new Echo({
  broadcaster: 'reverb',
  key: rawKey,
  wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
  forceTLS: scheme === 'https',
  enabledTransports: scheme === 'https' ? ['ws', 'wss'] : ['ws', 'wss'],
  disableStats: true,
  authEndpoint: '/broadcasting/auth',
  auth: { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
})
if ((window as any).Echo?.connector?.pusher) {
  const c = (window as any).Echo.connector.pusher.connection
  c.bind('error', (e: any) => console.warn('[reverb] error', e))
  c.bind('failed', () => console.warn('[reverb] failed'))
  c.bind('disconnected', () => console.warn('[reverb] disconnected'))
  c.bind('connected', () => console.info('[reverb] connected'))
}
