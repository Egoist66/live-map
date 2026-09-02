import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
// @ts-ignore
window.Pusher = Pusher
// @ts-ignore
window.Echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
  forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
  enabledTransports: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https' ? ['wss'] : ['ws'],
  disableStats: true,
})
