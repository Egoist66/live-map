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
 * Можно ли кешировать картинку в blob-кеш (fetch + IndexedDB).
 *
 * Кешируем только same-origin http(s): свой `/storage` и thumbs галереи.
 * Чужие CDN (t.me userpic, telegram-фото) `fetch()` не отдадут — у них нет
 * `Access-Control-Allow-Origin`, и консоль тонет в CORS-ошибках при каждом
 * открытии чата. Такие URL грузятся обычным `<img>` (ему CORS не нужен),
 * кеш их просто пропускает. `data:`/`blob:` — уже локальные, кешировать нечего.
 *
 * @param url исходный URL картинки
 * @returns true когда URL стоит кешировать
 */
export function isCacheableImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }
  const trimmed = url.trim()
  if (trimmed === '' || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return false
  }
  try {
    const origin = new URL(trimmed, window.location.href).origin
    return origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Хеш URL для ключа IndexedDB (djb2 по ПОЛНОМУ URL включая ?v=).
 *
 * Бэк ставит `?v=timestamp` при каждом update аватара/фото: версия обязана
 * входить в хеш, иначе новый файл с тем же базовым путём отдавал бы старый
 * blob (жалобы «сменил фото профиля — вижу старое»). Старые записи без
 * версии добираются legacy-фолбэком в resolveImageUrl и мигрируют сами.
 *
 * @param url исходный URL картинки
 * @returns hex-хеш полного URL
 */
export function hashImageUrl(url: string): string {
  const normalized = url.trim()
  let hash = 5381
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

/**
 * Legacy-хеш по базовому пути без query (для чтения кеша старых версий).
 *
 * @param url исходный URL картинки
 * @returns hex-хеш пути без query
 */
function hashImageUrlLegacy(url: string): string {
  const base = url.split('?')[0]
  let hash = 5381
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) + hash + base.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

/**
 * Найти строку кеша: сначала точный хеш (с ?v=), потом legacy (без).
 *
 * @param url исходный URL картинки
 * @returns строка кеша или undefined
 */
async function findImageRow(url: string) {
  const hash = hashImageUrl(url)
  try {
    const exact = await appDb.imageBlobs.get(hash)
    if (exact?.blob) {
      return { row: exact, hash }
    }
  } catch {}
  const legacyHash = hashImageUrlLegacy(url)
  if (legacyHash !== hash) {
    try {
      const legacy = await appDb.imageBlobs.get(legacyHash)
      if (legacy?.blob) {
        return { row: legacy, hash: legacyHash }
      }
    } catch {}
  }
  return null
}

/**
 * Отдать кешированный objectURL картинки или оригинал при промахе.
 *
 * Хит НЕ ходит в сеть вообще: только IndexedDB + память. Промах не
 * блокирует: возвращаем исходный URL сразу, а blob тихо докачиваем
 * в фон (следующий рендер уже мгновенный).
 *
 * @param url исходный URL картинки
 * @returns objectURL из кеша или исходный URL
 */
export async function resolveImageUrl(url: string): Promise<string> {
  if (!url || typeof window === 'undefined') {
    return url
  }
  // Чужой CDN (t.me и т.п.): fetch упрётся в CORS — даже не пробуем,
  // отдаём исходный URL для обычного <img> без единой ошибки в консоли.
  if (!isCacheableImageUrl(url)) {
    return url
  }
  const hash = hashImageUrl(url)
  const memory = memoryUrls.get(hash)
  if (memory) {
    void touchImageRow(hash)
    return memory
  }
  // Legacy-запись без ?v=: подхватить мгновенно и переложить на новый хеш.
  const legacyHash = hashImageUrlLegacy(url)
  if (legacyHash !== hash) {
    const legacyMemory = memoryUrls.get(legacyHash)
    if (legacyMemory) {
      memoryUrls.set(hash, legacyMemory)
      return legacyMemory
    }
  }
  try {
    const found = await findImageRow(url)
    if (found?.row?.blob) {
      const objectUrl = URL.createObjectURL(found.row.blob)
      memoryUrls.set(hash, objectUrl)
      if (found.hash !== hash) {
        memoryUrls.set(found.hash, objectUrl)
      }
      void touchImageRow(found.hash)
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
    // Внешние URL (t.me) не кешируем — см. isCacheableImageUrl.
    if (!isCacheableImageUrl(raw)) {
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
 * Чистим оба хеша (точный + legacy без ?v=), иначе старая запись
 * без версии продолжала бы отдаваться после замены фото.
 *
 * @param url URL удалённой картинки
 */
export async function invalidateImageUrl(url: string): Promise<void> {
  if (!url) {
    return
  }
  const hashes = [hashImageUrl(url), hashImageUrlLegacy(url)]
  for (const hash of hashes) {
    const memory = memoryUrls.get(hash)
    if (memory) {
      memoryUrls.delete(hash)
      // Один blob мог лежать под двумя хешами — revoke один раз.
      let stillUsed = false
      for (const other of memoryUrls.values()) {
        if (other === memory) {
          stillUsed = true
          break
        }
      }
      if (!stillUsed) {
        try {
          URL.revokeObjectURL(memory)
        } catch {}
      }
    }
    try {
      await appDb.imageBlobs.delete(hash)
    } catch {}
  }
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
 * Ключевой фикс: НЕ ставим исходный URL синхронно (браузер тут же
 * стрелял HTTP даже при 100% хите кеша — отсюда запросы после
 * перезагрузки). Стартуем с пустого/плейсхолдера, сначала тихо смотрим
 * IndexedDB: хит — ставим objectURL без единой сети, промах — исходный URL.
 *
 * @param source URL или геттер URL
 * @param placeholder что показать до резолва (по умолчанию '')
 * @returns src для :src
 * @example
 * const { src } = useCachedImageSrc(() => user.avatar_url)
 */
export function useCachedImageSrc(source: string | Ref<string | null | undefined> | (() => string | null | undefined), placeholder = ''): { src: Ref<string> } {
  const readSource = (): string => {
    if (typeof source === 'string') {
      return source
    }
    if (typeof source === 'function') {
      return (source() ?? '') as string
    }
    return (source.value ?? '') as string
  }
  const src = shallowRef<string>(placeholder)
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
    // Сначала кеш: хит — objectURL без HTTP, промах — исходный URL.
    // Один await IndexedDB (~мс) вместо гарантированного запроса в сеть.
    const resolved = await resolveImageUrl(url)
    if (alive && seq === current) {
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
 * Страховка от CORS: сюда попадают только same-origin URL
 * (проверено в resolveImageUrl), чужой CDN даже не трогаем fetch'ем.
 *
 * @param url исходный URL
 * @param hash хеш URL
 */
async function fetchAndStoreImage(url: string, hash: string): Promise<void> {
  if (!isCacheableImageUrl(url)) {
    return
  }
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
      url,
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
