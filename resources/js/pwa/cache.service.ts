import { CACHE_PREFIXES } from './pwa.config'

export interface StorageEstimate {
  usageMB: number
  quotaMB: number
  usageRatio: number
}

async function matchPrefixes(): Promise<string[]> {
  if (!('caches' in window)) return []
  try {
    const keys = await caches.keys()
    return keys.filter((k) => CACHE_PREFIXES.some((p) => k.startsWith(p)) || k.startsWith('pwa-'))
  } catch {
    return []
  }
}

export async function getEstimate(): Promise<StorageEstimate | null> {
  try {
    const est = await navigator.storage?.estimate()
    if (!est) return null
    const usageMB = (est.usage ?? 0) / 1048576
    const quotaMB = (est.quota ?? 0) / 1048576
    return { usageMB, quotaMB, usageRatio: quotaMB > 0 ? (est.usage ?? 0) / quotaMB : 0 }
  } catch {
    return null
  }
}

/**
 * Префикс прекэша оболочки: его не трогаем, иначе оффлайн-режим
 * умрёт до следующей установки SW.
 */
const PRECACHE_PREFIX = 'workbox-precache'

async function runtimeKeys(): Promise<string[]> {
  if (!('caches' in window)) return []
  try {
    const keys = await caches.keys()
    return keys.filter((k) => !k.startsWith(PRECACHE_PREFIX))
  } catch {
    return []
  }
}

export async function cachedKeys(): Promise<string[]> {
  return matchPrefixes()
}

export async function runtimeCachedKeys(): Promise<string[]> {
  return runtimeKeys()
}

/**
 * Стереть рантайм-кэш приложения (тайлы карты, фото, страницы, API).
 *
 * Удаляет ВСЕ разделы Cache Storage кроме активного прекэша оболочки:
 * фильтр только по `pwa-*` пропускал кэши с устаревшими именами от старых
 * версий SW — они висели мёртвым грузом, а очистка рапортовала
 * «уже пуст» при десятках мегабайт занятого места.
 *
 * @returns ключи реально удалённых разделов
 */
export async function clearRuntimeCaches(): Promise<string[]> {
  const keys = await runtimeKeys()
  const deleted: string[] = []
  for (const key of keys) {
    try {
      const ok = await caches.delete(key)
      if (ok) {
        deleted.push(key)
      }
    } catch {
      continue
    }
  }
  return deleted
}

/**
 * Стереть ВЕСЬ кэш приложения (Cache Storage целиком).
 *
 * @returns список удаленных ключей
 */
export async function clearAllCaches(): Promise<string[]> {
  if (!('caches' in window)) {
    return []
  }

  const keys = await caches.keys().catch(() => [] as string[])
  await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))

  return keys
}

/**
 * Полное обновление приложения: стирает весь кэш, будит новый SW и перезагружает страницу.
 */
export async function hardRefreshToLatest(): Promise<void> {
  try {
    await clearAllCaches()
  } catch {}

  try {
    const reg = await navigator.serviceWorker?.getRegistration('/').catch(() => null)
    await reg?.update().catch(() => {})
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  } catch {}

  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
}

export async function isOfflineReady(): Promise<boolean> {
  try {
    const cache = await caches.open('pwa-probe')
    await cache.put('/offline.html', await fetch('/offline.html').then((r) => r.clone()))
    await caches.delete('pwa-probe')
    return true
  } catch {
    const keys = await matchPrefixes()
    return keys.length > 0
  }
}

export async function persistStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist()) ?? false
  } catch {
    return false
  }
}
