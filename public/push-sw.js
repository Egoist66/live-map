/**
 * UPin push-воркер: подключается к сгенерированному sw.js через importScripts.
 *
 * Маршрутизация пуша:
 * - окно в фокусе — realtime-шина (Echo) уже показала in-app тост,
 *   системный баннер не дублируем, пейлоад отдаём странице сообщением `upin-push`;
 * - окно видно, но не в фокусе / окон нет — всегда системный баннер;
 * - подписка протухла (`pushsubscriptionchange`) — просим страницу переподписаться.
 */

let screenLocked = false

self.addEventListener('message', (event) => {
  const d = event.data || {}
  if (d.type === 'screen-lock') screenLocked = !!d.locked
})

function parsePushData(event) {
  if (!event.data) return null
  try {
    return event.data.json() || {}
  } catch {
    const text = event.data.text()
    return text ? { body: text } : null
  }
}

async function focusedClients() {
  try {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    return all.filter((c) => c.visibilityState === 'visible' && c.focused === true)
  } catch {
    return []
  }
}

function buildOptions(data) {
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
  if (Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions
  } else {
    options.actions = [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' },
    ]
  }
  return options
}

self.addEventListener('push', (event) => {
  if (screenLocked) return
  const data = parsePushData(event)
  if (!data) return
  const title = data.title || 'UPin'
  const options = buildOptions(data)
  event.waitUntil(
    (async () => {
      const focused = await focusedClients()
      if (focused.length > 0) {
        for (const client of focused) {
          try {
            client.postMessage({ type: 'upin-push', push: data })
          } catch {}
        }
        return
      }
      await self.registration.showNotification(title, options)
    })(),
  )
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of all) {
          try {
            client.postMessage({ type: 'upin-push-resubscribe' })
          } catch {}
        }
      } catch {}
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'close') return
  const rawUrl = (event.notification.data && event.notification.data.url) || '/'
  let target = rawUrl
  try {
    target = new URL(rawUrl, self.location.origin).href
  } catch {
    target = self.location.origin + '/'
  }
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if (client.url === target) {
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
