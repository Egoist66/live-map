let screenLocked = false
self.addEventListener('message', (event) => {
  const d = event.data || {}
  if (d.type === 'screen-lock') screenLocked = !!d.locked
})
self.addEventListener('push', (event) => {
  if (screenLocked) return
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'UPin'
  const options = {
    body: data.body || 'Новое уведомление',
    tag: data.tag || 'upin-push',
    icon: data.avatar || data.icon || '/pwa-192x192.png',
    badge: '/pwa-icon.svg',
    vibrate: [120, 60, 120],
    timestamp: Date.now(),
    renotify: true,
    requireInteraction: false,
    silent: false,
    lang: 'ru',
    dir: 'auto',
    data: { url: data.url || '/chat' },
  }
  if (data.actions) options.actions = data.actions
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  const target = new URL(url, self.location.origin).href
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if (client.url === target || client.url.startsWith(self.location.origin + url)) {
          await client.focus()
          return
        }
      }
      for (const client of clients) {
        if ('navigate' in client) {
          await client.navigate(target)
          await client.focus()
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
