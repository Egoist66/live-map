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

export async function cachedKeys(): Promise<string[]> {
  return matchPrefixes()
}

export async function clearRuntimeCaches(): Promise<void> {
  const keys = await matchPrefixes()
  await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)))
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
