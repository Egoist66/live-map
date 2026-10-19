import { appDb, type ScreenLockRow } from '@/db/app.db'
import { normalizeLockKind, type LockKind } from '@/validation/schemas/screenlock.schema'

const FALLBACK_PREFIX = 'screenlock:user:'
const LEGACY_CODE_KEY = 'screenlock:code'
const LEGACY_TIMEOUT_KEY = 'screenlock:timeout'
const LEGACY_KIND_KEY = 'screenlock:kind'
const LEGACY_MIRROR_KEY = 'screenlock:state'
const LEGACY_SERVER_KEY = 'screenlock:server-enabled'

const DEFAULT_TIMEOUT = 5
const DEFAULT_KIND: LockKind = 'pin4'

const PBKDF2_ITERATIONS = 120_000
const PBKDF2_PREFIX = 'pbkdf2'
const SHA256_PREFIX = 'sha256:'
const PLAIN_PREFIX = 'plain:'

/** IndexedDB недоступен в этой сессии (приватный режим/WebView). */
let idbBroken = false
/** Legacy-перенос уже проверяли: не дёргаем kv на каждое чтение. */
let legacyChecked = false

/**
 * Проверка наличия IndexedDB без обращения к базе.
 *
 * @returns true, если браузер поддерживает IndexedDB
 */
function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Есть ли Web Crypto (нет на небезопасном HTTP-контексте).
 *
 * @returns true, если доступен `crypto.subtle`
 */
function hasSubtleCrypto(): boolean {
  try {
    return typeof crypto !== 'undefined' && !!crypto.subtle
  } catch {
    return false
  }
}

/**
 * Перевести байты в hex.
 *
 * @param bytes сырые байты
 * @returns hex-строка в нижнем регистре
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Перевести hex в байты.
 *
 * @param hex hex-строка
 * @returns байты
 */
function hexToBytes(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g) ?? []
  return new Uint8Array(pairs.map((pair) => parseInt(pair, 16)))
}

/**
 * Ключ fallback-записи в localStorage.
 *
 * @param uid id пользователя
 * @returns ключ настройки скринлокера
 */
function fallbackKey(uid: number): string {
  return `${FALLBACK_PREFIX}${uid}`
}

/**
 * Привести сохранённый таймаут к допустимому значению.
 *
 * @param value сырое значение из хранилища
 * @returns 1, 5 или 10 минут
 */
function normalizeTimeout(value: unknown): number {
  const timeout = Number(value)
  return [1, 5, 10].includes(timeout) ? timeout : DEFAULT_TIMEOUT
}

/**
 * Собрать валидную строку настройки скринлокера.
 *
 * @param uid id пользователя
 * @param value частичные данные из хранилища
 * @returns нормализованная строка
 */
function normalizeRow(uid: number, value: Partial<ScreenLockRow>): ScreenLockRow {
  const codeHash = typeof value.codeHash === 'string' && value.codeHash !== '' ? value.codeHash : null

  return {
    uid,
    codeHash,
    timeout: normalizeTimeout(value.timeout),
    kind: normalizeLockKind(value.kind),
    updatedAt: Number(value.updatedAt) || Date.now(),
  }
}

/**
 * Захешировать код блокировки для локального хранения.
 *
 * В IndexedDB не кладём сам PIN/пароль: при наличии Web Crypto храним
 * PBKDF2-SHA-256 со случайной солью (перебор 4-значного PIN всё равно
 * возможен офлайн, но медленный и не мгновенный). На небезопасном
 * контексте (HTTP без localhost) crypto недоступен — падаем на явно
 * помеченный plaintext-фолбэк.
 *
 * Формат: `pbkdf2:<iterations>:<saltHex>:<hashHex>`.
 *
 * @param code введённый код
 * @returns строка хеша или `plain:<code>` без Web Crypto
 */
export async function hashLockCode(code: string): Promise<string> {
  if (!hasSubtleCrypto()) {
    return `${PLAIN_PREFIX}${code}`
  }

  try {
    const salt = crypto.getRandomValues(new Uint8Array(16)).buffer
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(code),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      baseKey,
      256,
    )
    const hashHex = bytesToHex(new Uint8Array(bits))
    return `${PBKDF2_PREFIX}:${PBKDF2_ITERATIONS}:${bytesToHex(new Uint8Array(salt))}:${hashHex}`
  } catch {
    return `${PLAIN_PREFIX}${code}`
  }
}

/**
 * Проверить код против сохранённого хеша.
 *
 * @param stored сохранённый хеш
 * @param input введённый код
 * @returns true, если код совпадает
 */
export async function matchLockCode(stored: string | null, input: string): Promise<boolean> {
  if (!stored) return false
  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length) === input
  }

  // Старый формат промежуточной версии — обычный SHA-256 без соли.
  // Оставляем проверку, чтобы локер не «забыл» код после обновления;
  // при следующем сохранении запись перезапишется в PBKDF2.
  if (stored.startsWith(SHA256_PREFIX)) {
    if (!hasSubtleCrypto()) return false
    try {
      const bytes = new TextEncoder().encode(input)
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      return bytesToHex(new Uint8Array(digest)) === stored.slice(SHA256_PREFIX.length)
    } catch {
      return false
    }
  }

  const parts = stored.split(':')
  if (parts[0] !== PBKDF2_PREFIX || parts.length !== 4) return false

  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  if (!hasSubtleCrypto()) return false

  try {
    const salt = hexToBytes(parts[2]).buffer as ArrayBuffer
    const expected = parts[3]
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(input),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      baseKey,
      256,
    )
    return bytesToHex(new Uint8Array(bits)) === expected
  } catch {
    return false
  }
}

/**
 * Прочитать fallback-запись из localStorage.
 *
 * @param uid id пользователя
 * @returns строка настройки или null
 */
function readFallback(uid: number): ScreenLockRow | null {
  try {
    const raw = localStorage.getItem(fallbackKey(uid))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ScreenLockRow>
    return normalizeRow(uid, parsed)
  } catch {
    return null
  }
}

/**
 * Записать fallback-запись в localStorage.
 *
 * @param row строка настройки
 */
function writeFallback(row: ScreenLockRow): void {
  try {
    localStorage.setItem(fallbackKey(row.uid), JSON.stringify(row))
  } catch {}
}

/**
 * Удалить fallback-запись пользователя.
 *
 * @param uid id пользователя
 */
function deleteFallback(uid: number): void {
  try {
    localStorage.removeItem(fallbackKey(uid))
  } catch {}
}

/**
 * Удалить legacy-ключи глобального (не per-user) скринлокера.
 */
async function cleanupLegacy(): Promise<void> {
  try {
    await Promise.all([
      appDb.kv.delete(LEGACY_CODE_KEY),
      appDb.kv.delete(LEGACY_TIMEOUT_KEY),
      appDb.kv.delete(LEGACY_KIND_KEY),
    ])
  } catch {}

  try {
    localStorage.removeItem(LEGACY_MIRROR_KEY)
    localStorage.removeItem(LEGACY_SERVER_KEY)
  } catch {}
}

/**
 * Перенести глобальные настройки старой версии в запись текущего пользователя.
 *
 * Раньше код лежал в общем `kv` и localStorage без uid, поэтому переносим
 * его один раз при первом чтении: иначе у существующих пользователей
 * локер молча выключится после обновления.
 *
 * @param uid id пользователя
 * @returns перенесённая строка или null
 */
async function migrateLegacy(uid: number): Promise<ScreenLockRow | null> {
  if (legacyChecked) return null
  legacyChecked = true

  let legacyCode: string | null = null
  let legacyTimeout: unknown = DEFAULT_TIMEOUT
  let legacyKind: unknown = DEFAULT_KIND

  try {
    const [code, timeout, kind] = await Promise.all([
      appDb.kv.get(LEGACY_CODE_KEY),
      appDb.kv.get(LEGACY_TIMEOUT_KEY),
      appDb.kv.get(LEGACY_KIND_KEY),
    ])
    legacyCode = code?.value ?? null
    legacyTimeout = timeout?.value ?? DEFAULT_TIMEOUT
    legacyKind = kind?.value ?? DEFAULT_KIND
  } catch {}

  if (!legacyCode) {
    await cleanupLegacy()
    return null
  }

  const row = normalizeRow(uid, {
    codeHash: await hashLockCode(legacyCode),
    timeout: Number(legacyTimeout),
    kind: legacyKind as string,
    updatedAt: Date.now(),
  })
  await writeScreenLock(uid, row)
  await cleanupLegacy()
  return row
}

/**
 * Прочитать настройку скринлокера пользователя.
 *
 * Источник правды — IndexedDB. Если браузер её не поддерживает или
 * хранилище недоступно (приватный режим/WebView), прозрачно читаем
 * localStorage под тем же per-user ключом.
 *
 * @param uid id пользователя
 * @returns настройка или null, если пользователь ещё не включал локер
 */
export async function readScreenLock(uid: number): Promise<ScreenLockRow | null> {
  if (!uid) return null

  if (!idbBroken && hasIndexedDb()) {
    try {
      const row = await appDb.screenLock.get(uid)
      if (row) return normalizeRow(uid, row)

      const migrated = await migrateLegacy(uid)
      if (migrated) return migrated

      // Запись могла остаться в localStorage после сессии, где IndexedDB
      // был недоступен (приватный режим/WebView) — поднимаем её обратно.
      return readFallback(uid)
    } catch {
      idbBroken = true
    }
  }

  return readFallback(uid)
}

/**
 * Сохранить настройку скринлокера пользователя.
 *
 * @param uid id пользователя
 * @param row хеш кода, таймаут и тип блокировки
 */
export async function writeScreenLock(uid: number, row: ScreenLockRow): Promise<void> {
  const normalized = normalizeRow(uid, row)

  if (!idbBroken && hasIndexedDb()) {
    try {
      await appDb.screenLock.put(normalized)
      deleteFallback(uid)
      return
    } catch {
      idbBroken = true
    }
  }

  writeFallback(normalized)
}

/**
 * Удалить настройку скринлокера пользователя из обоих хранилищ.
 *
 * @param uid id пользователя
 */
export async function deleteScreenLock(uid: number): Promise<void> {
  deleteFallback(uid)

  if (!hasIndexedDb()) return

  // Пробуем всегда, даже если чтение ранее упало: удаление должно
  // зачистить запись, когда хранилище снова доступно.
  try {
    await appDb.screenLock.delete(uid)
  } catch {}
}
