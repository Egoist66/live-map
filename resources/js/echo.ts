import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
// @ts-ignore
window.Pusher = Pusher
Pusher.logToConsole = false
console.log('[reverb] env', import.meta.env)
const scheme = import.meta.env.VITE_REVERB_SCHEME || 'https'
const rawKey = import.meta.env.VITE_REVERB_APP_KEY
console.log('[reverb] key', rawKey ? rawKey.slice(0,4)+'***' : 'MISSING', 'host', import.meta.env.VITE_REVERB_HOST, 'port', import.meta.env.VITE_REVERB_PORT, 'scheme', scheme)
if (!rawKey) {
  console.warn('[reverb] VITE_REVERB_APP_KEY missing — Echo disabled, realtime off')
  // @ts-ignore
  window.Echo = null
} else {
  // @ts-ignore
  window.Echo = new Echo({
    broadcaster: 'reverb',
    key: rawKey,
    wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
    forceTLS: scheme === 'https',
    enabledTransports: scheme === 'https' ? ['ws', 'wss'] : ['ws', 'wss'],
    disableStats: true,
    authEndpoint: '/broadcasting/auth',
    auth: { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
  })
}
if ((window as any).Echo?.connector?.pusher) {
  const c = (window as any).Echo.connector.pusher.connection
  c.bind('error', (e: any) => console.warn('[reverb] error', e))
  c.bind('failed', () => console.warn('[reverb] failed'))
  c.bind('disconnected', () => console.warn('[reverb] disconnected'))
  c.bind('connected', () => console.info('[reverb] connected'))
}
