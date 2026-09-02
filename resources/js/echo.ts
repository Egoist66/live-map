import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
// @ts-ignore
window.Pusher = Pusher
Pusher.logToConsole = false
const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http'
// @ts-ignore
window.Echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
  forceTLS: scheme === 'https',
  enabledTransports: scheme === 'https' ? ['wss'] : ['ws'],
  disableStats: true,
  authEndpoint: '/broadcasting/auth',
})
if ((window as any).Echo?.connector?.pusher) {
  const c = (window as any).Echo.connector.pusher.connection
  c.bind('error', () => {})
  c.bind('failed', () => {})
}
