import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useForm } from 'vee-validate'
import { useToast } from 'primevue/usetoast'
import { cleanupStrayScrollLocks } from '@/composables/useScrollRescue'
import { captureAuthUid, currentAuthUid } from '@/composables/useAuthUid'
import { deleteScreenLock, hashLockCode, matchLockCode, readScreenLock, writeScreenLock } from '@/db/screenlock.db'
import { screenLockApi } from '@/services/screenlock.api'
import { busOn } from '@/services/realtime-bus'
import { screenLockSetupSchema, normalizeLockKind } from '@/validation/schemas/screenlock.schema'
import type { LockKind } from '@/validation/schemas/screenlock.schema'

const DEFAULT_TIMEOUT = 5
const DEFAULT_KIND: LockKind = 'pin4'
const SEEN_RESET_KEY = 'screenlock:seen-reset'

/**
 * Детерминированный старт для SSR: сервер и первая гидрация всегда
 * видят выключенный локер. Настройки из IndexedDB подтягиваются в
 * init() после монтирования, поэтому кнопка замка в шапке не даёт
 * mismatch. Модульный уровень никогда не читает хранилища: в Node их
 * нет, а на клиенте чтение при импорте расходилось бы с серверным HTML.
 */
const enabled = ref(false)
const timeoutMin = ref(DEFAULT_TIMEOUT)
const kind = ref<LockKind>(DEFAULT_KIND)
const locked = ref(false)
const loading = ref(false)
const saving = ref(false)
const verifying = ref(false)
const error = ref<string | null>(null)
const initialized = ref(false)

/** Хеш кода блокировки текущего пользователя (сам код не храним). */
let cachedHash: string | null = null
let cachedUid = 0
let lastPoke = 0
let timer: ReturnType<typeof setTimeout> | null = null
let bound = false
let resetListenerBound = false

/**
 * Ключ localStorage с последней применённой меткой сброса.
 *
 * Метка нужна, чтобы один и тот же серверный сброс не стирал локер
 * повторно после каждого входа и не затирал код, который пользователь
 * уже успел задать заново.
 *
 * @param uid id пользователя
 * @returns ключ хранилища
 */
function seenResetKey(uid: number): string {
  return `${SEEN_RESET_KEY}:${uid}`
}

/**
 * Прочитать последнюю применённую метку сброса.
 *
 * @param uid id пользователя
 * @returns миллисекунды метки (0 — сбросов ещё не было)
 */
function readSeenReset(uid: number): number {
  try {
    return Number(localStorage.getItem(seenResetKey(uid)) || 0) || 0
  } catch {
    return 0
  }
}

/**
 * Запомнить применённую метку сброса.
 *
 * @param uid id пользователя
 * @param resetAt миллисекунды метки
 */
function writeSeenReset(uid: number, resetAt: number): void {
  try {
    localStorage.setItem(seenResetKey(uid), String(resetAt))
  } catch {}
}

/**
 * Id текущего пользователя с запасными источниками.
 *
 * Хук зовут и в setup, и из обработчиков событий: `usePage` вне setup
 * может быть недоступен, поэтому падаем на кэш `useAuthUid`, meta-тег
 * и `window.userId` — как это делает стор бейджей.
 *
 * @returns id пользователя (0 — гость/неизвестно)
 */
function resolveUid(): number {
  // Сначала живая Inertia-страница: при смене аккаунта без перезагрузки
  // кэш useAuthUid обновляется только в router.on('success') и на момент
  // перечитывания ещё может указывать на прежнего пользователя.
  try {
    const inertiaUid = Number((usePage().props.auth as any)?.user?.id || 0)
    if (inertiaUid > 0) return inertiaUid
  } catch {}

  const cached = currentAuthUid()
  if (cached > 0) return cached

  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta) || 0
  } catch {}

  try {
    return Number((window as any).userId || 0)
  } catch {
    return 0
  }
}

/**
 * Применить настройку пользователя к реактивному состоянию.
 *
 * @param row прочитанная строка или null
 */
function applyRow(row: Awaited<ReturnType<typeof readScreenLock>>): void {
  cachedHash = row?.codeHash ?? null
  enabled.value = !!cachedHash
  timeoutMin.value = row?.timeout ?? DEFAULT_TIMEOUT
  kind.value = normalizeLockKind(row?.kind)
}

/**
 * Глобальный сброс скринлока при смене аккаунта / выходе.
 *
 * Чинит баг: вышел из A (локер включён), зашёл в B (локер выключен) —
 * через 5 минут прилетал чужой таймер и лочил экран B. Причина —
 * модульный синглтон хранил enabled/timeout/cachedHash юзера A.
 *
 * Настройки в хранилище НЕ удаляются: локер — личная настройка
 * устройства и должен пережить выход/вход тем же аккаунтом.
 */
export function resetScreenLockSession(): void {
  disarm()
  locked.value = false
  enabled.value = false
  cachedHash = null
  cachedUid = 0
  timeoutMin.value = DEFAULT_TIMEOUT
  kind.value = DEFAULT_KIND
  initialized.value = false
  lastPoke = 0
  error.value = null
  broadcastLockState()
}

function disarm() {
  if (timer) clearTimeout(timer)
  timer = null
}

function broadcastLockState() {
  try {
    const msg = { type: 'screen-lock', locked: locked.value }
    if (navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage(msg)
    navigator.serviceWorker?.ready.then((reg) => {
      try { (reg.active as any)?.postMessage(msg) } catch {}
    }).catch(() => {})
  } catch {}
}

/**
 * Сообщить серверу флаг активности (для пункта «Сброс скринлокера» в боте).
 *
 * Сеть здесь не критична: локер работает и без неё, а ошибку глотаем,
 * чтобы сохранение кода не падало из-за offline.
 *
 * @param active включён ли локер
 */
async function reportActive(active: boolean): Promise<void> {
  try {
    await screenLockApi.reportActive(active)
  } catch {}
}

/**
 * Метка сброса из Inertia-пропсов (auth.user.screen_lock_reset_at).
 *
 * Нужна на старте: если сброс сделали через бота, пока приложение было
 * закрыто, сокет-событие уже не придёт — сверяемся с сервером напрямую.
 *
 * @returns миллисекунды метки (0 — сбросов не было)
 */
function serverResetMark(): number {
  try {
    const raw = (usePage().props.auth as any)?.user?.screen_lock_reset_at
    if (!raw) return 0
    const parsed = typeof raw === 'number' ? raw : Date.parse(String(raw))
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

/**
 * Применить серверный сброс: стереть локальный код, если метка новее записи.
 *
 * @param uid чей локер сбрасываем
 * @param resetAt метка сброса в миллисекундах
 */
async function applyRemoteReset(uid: number, resetAt: number): Promise<void> {
  if (!uid || resetAt <= 0) return

  const seen = readSeenReset(uid)
  if (resetAt <= seen) return

  writeSeenReset(uid, resetAt)

  const row = await readScreenLock(uid)
  // Локальная запись новее метки — код задали уже после сброса, не трогаем.
  if (!row || row.updatedAt >= resetAt) return

  await deleteScreenLock(uid)

  if (uid !== cachedUid && uid !== resolveUid()) return

  cachedHash = null
  enabled.value = false
  locked.value = false
  broadcastLockState()
  disarm()
}

/**
 * Подписаться на realtime-сброс скринлокера (сокет и polling-эмит).
 */
function bindResetListener(): void {
  if (resetListenerBound || typeof window === 'undefined') return
  resetListenerBound = true

  busOn('user:screen-lock.reset', (payload) => {
    const uid = cachedUid || resolveUid()
    const resetAt = Number((payload as any)?.reset_at ?? 0)
    void applyRemoteReset(uid, resetAt)
  })
}

function arm() {
  disarm()
  if (!enabled.value || locked.value) return
  timer = setTimeout(() => {
    locked.value = true
    broadcastLockState()
    disarm()
  }, Math.max(1, timeoutMin.value) * 60_000)
}

function poke() {
  if (!enabled.value || locked.value) return
  const now = Date.now()
  if (now - lastPoke < 2000) return
  lastPoke = now
  arm()
}

function onActivity() {
  poke()
}

function bind() {
  if (bound || typeof window === 'undefined') return
  bound = true
  window.addEventListener('pointerdown', onActivity, { passive: true })
  window.addEventListener('keydown', onActivity)
  window.addEventListener('touchstart', onActivity, { passive: true })
  window.addEventListener('mousemove', onActivity, { passive: true })
  window.addEventListener('wheel', onActivity, { passive: true })
  window.addEventListener('scroll', onActivity, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) poke()
  })
}

/**
 * Сохранить настройку текущего пользователя в IndexedDB.
 *
 * @param codeHash хеш кода блокировки (null — выключить)
 * @param timeout автоблокировка в минутах
 * @param nextKind тип кода
 * @returns true, если запись удалась
 */
async function persist(codeHash: string | null, timeout: number, nextKind: LockKind): Promise<boolean> {
  const uid = cachedUid || resolveUid()
  if (!uid) {
    error.value = 'Не удалось определить пользователя'
    return false
  }

  cachedUid = uid
  await writeScreenLock(uid, {
    uid,
    codeHash,
    timeout,
    kind: nextKind,
    updatedAt: Date.now(),
  })
  return true
}

/**
 * Оставить в коде только допустимые символы и обрезать до нужной длины.
 *
 * @param value сырой ввод пользователя
 * @param kind тип блокировки
 * @returns очищенный код
 */
export function sanitizeLockCode(value: unknown, kind: string): string {
  const text = String(value ?? '')
  if (kind === 'alpha8') return text.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  return text.replace(/\D/g, '').slice(0, 4)
}

export function useScreenLock() {
  captureAuthUid()
  const isActive = computed(() => enabled.value)
  const isLocked = computed(() => enabled.value && locked.value)

  async function init() {
    bind()
    bindResetListener()
    if (initialized.value) {
      arm()
      return
    }
    await load()
  }

  /**
   * Прочитать настройку текущего пользователя из локального хранилища.
   *
   * Код блокировки живёт только на устройстве, но факт активности
   * сообщается серверу: без него бот не покажет «Сброс скринлокера».
   */
  async function load() {
    loading.value = true
    error.value = null
    try {
      const uid = resolveUid()
      cachedUid = uid
      const row = uid ? await readScreenLock(uid) : null
      applyRow(row)
      if (uid) await applyRemoteReset(uid, serverResetMark())
      // Отправляем только true: устройство без локера не должно затирать
      // флаг, выставленный другим устройством того же аккаунта.
      if (cachedHash) void reportActive(true)
    } finally {
      loading.value = false
      initialized.value = true
    }
    locked.value = false
    broadcastLockState()
    arm()
  }

  async function save(code: string, timeout: number, nextKind?: LockKind) {
    const nextKindValue = normalizeLockKind(nextKind ?? kind.value)
    saving.value = true
    error.value = null
    try {
      const codeHash = await hashLockCode(code)
      const saved = await persist(codeHash, timeout, nextKindValue)
      if (!saved) return
      cachedHash = codeHash
      enabled.value = true
      timeoutMin.value = timeout
      kind.value = nextKindValue
      locked.value = false
      broadcastLockState()
      arm()
      void reportActive(true)
    } catch {
      error.value = 'Не удалось сохранить код'
    } finally {
      saving.value = false
    }
  }

  async function changeTimeout(timeout: number) {
    if (!cachedHash) {
      error.value = 'Введи код, чтобы сменить таймаут'
      return
    }
    saving.value = true
    error.value = null
    try {
      const saved = await persist(cachedHash, timeout, kind.value)
      if (!saved) return
      timeoutMin.value = timeout
      arm()
    } catch {
      error.value = 'Не удалось сохранить таймаут'
    } finally {
      saving.value = false
    }
  }

  async function remove() {
    saving.value = true
    error.value = null
    try {
      const saved = await persist(null, timeoutMin.value, kind.value)
      if (!saved) return
      cachedHash = null
      enabled.value = false
      locked.value = false
      broadcastLockState()
      disarm()
      void reportActive(false)
    } catch {
      error.value = 'Не удалось выключить'
    } finally {
      saving.value = false
    }
  }

  async function verify(input: string): Promise<boolean> {
    verifying.value = true
    error.value = null
    try {
      if (!cachedHash) {
        const uid = cachedUid || resolveUid()
        const row = uid ? await readScreenLock(uid) : null
        cachedHash = row?.codeHash ?? null
      }

      if (!cachedHash) {
        error.value = 'Код не найден на этом устройстве'
        return false
      }

      const matches = await matchLockCode(cachedHash, input)
      if (!matches) {
        error.value = 'Неверный код'
        return false
      }

      locked.value = false
      broadcastLockState()
      arm()
      // После анлока — контрольный проход спасателя скролла: модалка,
      // открытая под локскрином, или оборванный transition могли
      // оставить сиротскую маску/лок («мёртвая» страница в Mini App).
      // С задержкой: уходящий оверлей ещё виден во время фейда и
      // легитимен, чистим после его демонтажа.
      window.setTimeout(() => {
        try {
          cleanupStrayScrollLocks()
        } catch {
          // No-op.
        }
      }, 450)
      return true
    } finally {
      verifying.value = false
    }
  }

  function lockNow() {
    if (!enabled.value) return
    locked.value = true
    broadcastLockState()
    disarm()
  }

  /**
   * Полностью удалить настройку текущего пользователя.
   *
   * Используется при удалении аккаунта на этом устройстве: обычный
   * выход настройку не трогает.
   *
   * @param uid чей id чистить (по умолчанию — текущего пользователя)
   */
  async function forget(uid?: number): Promise<void> {
    const targetUid = uid ?? cachedUid ?? resolveUid()
    if (targetUid) await deleteScreenLock(targetUid)
    cachedHash = null
    enabled.value = false
    locked.value = false
    broadcastLockState()
    disarm()
  }

  /**
   * Сбросить локальный код после подтверждённого серверного сброса.
   *
   * Метку запоминаем, чтобы тот же сброс не пришёл повторно из polling
   * и не стёр код, который пользователь уже задал заново.
   *
   * @param resetAt метка сброса в миллисекундах
   */
  async function resetByRemote(resetAt: number): Promise<void> {
    const uid = cachedUid || resolveUid()
    if (uid && resetAt > 0) writeSeenReset(uid, resetAt)
    if (uid) await deleteScreenLock(uid)
    cachedHash = null
    enabled.value = false
    locked.value = false
    broadcastLockState()
    disarm()
  }

  return {
    enabled: isActive,
    timeoutMin,
    kind,
    locked: isLocked,
    loading,
    saving,
    verifying,
    error,
    initialized,
    init,
    load,
    save,
    changeTimeout,
    remove,
    verify,
    lockNow,
    poke,
    forget,
    resetByRemote,
  }
}

export function useScreenLockSetup() {
  const lock = useScreenLock()
  const toast = (() => { try { return useToast() } catch { return null as any } })()
  const { defineField, handleSubmit, errors, values, resetForm, setValues } = useForm({
    validationSchema: screenLockSetupSchema,
    initialValues: { kind: 'pin4', code: '', confirm: '', timeout: 5 },
  })
  const [kindField] = defineField('kind')
  const [code, codeAttrs] = defineField('code')
  const [confirm, confirmAttrs] = defineField('confirm')
  const [timeout] = defineField('timeout')
  function setKind(v: 'pin4' | 'alpha8') {
    setValues({ kind: v, code: '', confirm: '' } as any)
  }
  const submit = handleSubmit(async (v: any) => {
    await lock.save(v.code, v.timeout, v.kind)
    if (lock.enabled.value) {
      toast?.add({ severity: 'success', summary: 'Скринлокер активирован', detail: 'Замок появился в шапке возле колокольчика', life: 3500 })
      resetForm({ values: { kind: v.kind, code: '', confirm: '', timeout: v.timeout } as any })
    } else if (lock.error.value) {
      toast?.add({ severity: 'error', summary: 'Не вышло', detail: lock.error.value, life: 3500 })
    }
  })
  return { lock, kindField, code, codeAttrs, confirm, confirmAttrs, timeout, errors, values, setKind, submit }
}
