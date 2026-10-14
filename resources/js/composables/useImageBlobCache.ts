import { onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import { appDb } from '@/db/app.db'

/**
 * Бинарный кеш картинок (аватары, thumbs галереи) в IndexedDB.
 *
 * JSON-кеш (списки диалогов/фото) даёт мгновенную структуру, но сами
 * `<img>` всё равно ждали бы сеть. Этот слой хранит маленькие бинарники
 * (≤250 КБ) и отдаёт их через `URL.createObjectURL` за миллисекунды.
 * Большие оригиналы не трогаем — их покрывает HTTP-кеш браузера.
 *
 * Инвалидация точечная: версия уже зашита в URL (`?v=timestamp` ставит
 * бэк при каждом update), поэтому новый URL = новый hash = новый blob,
 * старый чистится LRU. Ручной `invalidateImageUrl` нужен только при
 * удалении фото.
 *
 * @example
 * const { src } = useCachedImageSrc(() => photo.thumb_url ?? photo.url)
 * // <img :src="src" />
 */
const MAX_BLOB_BYTES = 250 * 1024
const MAX_ENTRIES = 300
const PREFETCH_PER_CALL = 12

const memoryUrls = new Map<string, string>()

/**
 * Хеш URL для ключа IndexedDB (djb2, без query-версии ?v=).
 *
 * @param url исходный URL картинки
 * @returns hex-хеш нормализованного URL
 */
export function hashImageUrl(url: string): string {
  const base = url.split('?')[0]
  let hash = 5381
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) + hash + base.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

/**
 * Отдать кешированный objectURL картинки или оригинал при промахе.
 *
 * Промах не блокирует: возвращаем исходный URL сразу, а blob тихо
 * докачиваем в фон (следующий рендер уже мгновенный).
 *
 * @param url исходный URL картинки
 * @returns objectURL из кеша или исходный URL
 */
export async function resolveImageUrl(url: string): Promise<string> {
  if (!url || typeof window === 'undefined') {
    return url
  }
  const hash = hashImageUrl(url)
  const memory = memoryUrls.get(hash)
  if (memory) {
    void touchImageRow(hash)
    return memory
  }
  try {
    const row = await appDb.imageBlobs.get(hash)
    if (row?.blob) {
      const objectUrl = URL.createObjectURL(row.blob)
      memoryUrls.set(hash, objectUrl)
      void touchImageRow(hash)
      return objectUrl
    }
  } catch {
    return url
  }
  void fetchAndStoreImage(url, hash)
  return url
}

/**
 * Прогреть кеш пачкой URL (фон после отрисовки списков).
 *
 * @param urls URL картинок (аватары сайдбара, thumbs сетки)
 */
export async function prefetchImageUrls(urls: Array<string | null | undefined>): Promise<void> {
  const uniq: string[] = []
  const seen = new Set<string>()
  for (const raw of urls) {
    if (typeof raw !== 'string' || raw === '') {
      continue
    }
    if (seen.has(raw)) {
      continue
    }
    seen.add(raw)
    uniq.push(raw)
    if (uniq.length >= PREFETCH_PER_CALL) {
      break
    }
  }
  if (uniq.length === 0) {
    return
  }
  const tasks = uniq.map((url) => resolveImageUrl(url))
  await Promise.allSettled(tasks)
}

/**
 * Точечно выкинуть картинку из кеша (удаление/замена фото).
 *
 * @param url URL удалённой картинки
 */
export async function invalidateImageUrl(url: string): Promise<void> {
  if (!url) {
    return
  }
  const hash = hashImageUrl(url)
  const memory = memoryUrls.get(hash)
  if (memory) {
    memoryUrls.delete(hash)
    try {
      URL.revokeObjectURL(memory)
    } catch {}
  }
  try {
    await appDb.imageBlobs.delete(hash)
  } catch {}
}

/**
 * Полностью очистить бинарный кеш (логаут).
 */
export async function clearImageCache(): Promise<void> {
  for (const objectUrl of memoryUrls.values()) {
    try {
      URL.revokeObjectURL(objectUrl)
    } catch {}
  }
  memoryUrls.clear()
  try {
    await appDb.imageBlobs.clear()
  } catch {}
}

/**
 * Реактивный src картинки с подменой на кешированный blob.
 *
 * Стартует с исходного URL (мгновенный первый кадр через HTTP-кеш),
 * затем тихо меняет на objectURL из IndexedDB, когда тот готов.
 *
 * @param source URL или геттер URL
 * @returns src для :src
 * @example
 * const { src } = useCachedImageSrc(() => user.avatar_url)
 */
export function useCachedImageSrc(source: string | Ref<string | null | undefined> | (() => string | null | undefined)): { src: Ref<string> } {
  const readSource = (): string => {
    if (typeof source === 'string') {
      return source
    }
    if (typeof source === 'function') {
      return (source() ?? '') as string
    }
    return (source.value ?? '') as string
  }
  const src = shallowRef<string>(readSource())
  let alive = true
  let seq = 0

  async function apply(url: string): Promise<void> {
    const current = seq + 1
    seq = current
    if (!url) {
      if (alive && seq === current) {
        src.value = ''
      }
      return
    }
    src.value = url
    const resolved = await resolveImageUrl(url)
    if (alive && seq === current && resolved !== url) {
      src.value = resolved
    }
  }

  if (typeof source === 'object' && source !== null && 'value' in source) {
    watch(
      () => (source as Ref<string | null | undefined>).value,
      (next) => {
        void apply(next ?? '')
      },
      { immediate: true },
    )
  } else if (typeof source === 'function') {
    watch(source as () => string | null | undefined, (next) => {
      void apply(next ?? '')
    }, { immediate: true })
  } else {
    void apply(readSource())
  }

  try {
    onBeforeUnmount(() => {
      alive = false
    })
  } catch {}

  return { src: src as Ref<string> }
}

/**
 * Скачать картинку в кеш (фон, без блокировки рендера).
 *
 * @param url исходный URL
 * @param hash хеш URL
 */
async function fetchAndStoreImage(url: string, hash: string): Promise<void> {
  let response: Response | null = null
  try {
    response = await fetch(url, { credentials: 'same-origin' })
  } catch {
    return
  }
  if (!response || !response.ok) {
    return
  }
  let blob: Blob | null = null
  try {
    blob = await response.blob()
  } catch {
    return
  }
  if (!blob || blob.size === 0 || blob.size > MAX_BLOB_BYTES) {
    return
  }
  const mime = blob.type || 'image/jpeg'
  try {
    await appDb.imageBlobs.put({
      hash,
      url: url.split('?')[0],
      mime,
      size: blob.size,
      lastUsed: Date.now(),
      blob,
    })
  } catch {
    await evictOldestImages(20)
    return
  }
  await evictOldestImages(0)
}

/**
 * Обновить lastUsed записи (LRU).
 *
 * @param hash хеш URL
 */
async function touchImageRow(hash: string): Promise<void> {
  try {
    await appDb.imageBlobs.update(hash, { lastUsed: Date.now() })
  } catch {}
}

/**
 * Выкинуть старые записи сверх лимита.
 *
 * @param extra дополнительно удалить записей
 */
async function evictOldestImages(extra: number): Promise<void> {
  try {
    const count = await appDb.imageBlobs.count()
    const overflow = count - MAX_ENTRIES + extra
    if (overflow <= 0) {
      return
    }
    const oldest = await appDb.imageBlobs.orderBy('lastUsed').limit(overflow).toArray()
    for (const row of oldest) {
      const memory = memoryUrls.get(row.hash)
      if (memory) {
        memoryUrls.delete(row.hash)
        try {
          URL.revokeObjectURL(memory)
        } catch {}
      }
    }
    const hashes = oldest.map((row) => row.hash)
    await appDb.imageBlobs.bulkDelete(hashes)
  } catch {}
}
