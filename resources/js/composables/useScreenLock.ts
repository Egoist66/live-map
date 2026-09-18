import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { useToast } from 'primevue/usetoast'
import { fetchScreenLock, saveScreenLock, clearScreenLock, verifyScreenLock, normalizeKind } from '@/services/screenlock.api'
import { kvGet, kvSet, kvDel } from '@/db/app.db'
import { screenLockSetupSchema } from '@/validation/schemas/screenlock.schema'
import type { LockKind } from '@/validation/schemas/screenlock.schema'

const CODE_KEY = 'screenlock:code'
const TIMEOUT_KEY = 'screenlock:timeout'
const KIND_KEY = 'screenlock:kind'
const LS_MIRROR = 'screenlock:state'
const LS_SERVER = 'screenlock:server-enabled'

function readMirror(): { enabled: boolean; timeout: number; kind: LockKind } {
  try {
    const raw = localStorage.getItem(LS_MIRROR)
    if (!raw) return { enabled: false, timeout: 5, kind: 'pin4' }
    const p = JSON.parse(raw)
    return {
      enabled: !!p.enabled,
      timeout: Number(p.timeout) || 5,
      kind: normalizeKind(p.kind),
    }
  } catch {
    return { enabled: false, timeout: 5, kind: 'pin4' }
  }
}

function writeMirror(enabledVal: boolean, timeout: number, kindVal: LockKind) {
  try {
    localStorage.setItem(LS_MIRROR, JSON.stringify({ enabled: enabledVal, timeout, kind: kindVal }))
  } catch {}
}

/**
 * Последнее известное состояние локера: истина сервера при онлайне,
 * намерение юзера при офлайн-сохранении. Лечит баг: запрос упал
 * (419/500/офлайн на старте), а протухший код в IndexedDB включал
 * локер, хотя в БД пароль уже null.
 *
 * @returns true/false — последнее состояние, null — неизвестно
 */
function readServerEnabled(): boolean | null {
  try {
    const raw = localStorage.getItem(LS_SERVER)
    if (raw === '1') return true
    if (raw === '0') return false
    return null
  } catch {
    return null
  }
}

/**
 * Запомнить последнее известное состояние локера.
 *
 * @param value true — включён, false — выключен
 */
function writeServerEnabled(value: boolean): void {
  try {
    localStorage.setItem(LS_SERVER, value ? '1' : '0')
  } catch {}
}

function clearServerEnabled(): void {
  try {
    localStorage.removeItem(LS_SERVER)
  } catch {}
}

export function sanitizeLockCode(v: unknown, kind: string): string {
  const s = String(v ?? '')
  if (kind === 'alpha8') return s.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)
  return s.replace(/\D/g, '').slice(0, 4)
}

/**
 * Детерминированный старт для SSR: сервер и первая гидрация всегда
 * видят выключенный локер (enabled=false, pin4, 5 мин). Зеркало из
 * localStorage подтягивается в init() после монтирования, поэтому
 * кнопка замка в шапке не даёт mismatch. Модульный уровень никогда
 * не читает localStorage: в Node его нет, а на клиенте чтение при
 * импорте расходилось бы с серверным HTML.
 */
const DEFAULT_MIRROR: { enabled: boolean; timeout: number; kind: LockKind } = {
  enabled: false,
  timeout: 5,
  kind: 'pin4',
}
const enabled = ref(DEFAULT_MIRROR.enabled)
const timeoutMin = ref(DEFAULT_MIRROR.timeout)
const kind = ref<LockKind>(DEFAULT_MIRROR.kind)
const locked = ref(false)
const loading = ref(false)
const saving = ref(false)
const verifying = ref(false)
const error = ref<string | null>(null)
const initialized = ref(false)
const offline = ref(false)

let cachedCode: string | null = null
let lastPoke = 0
let timer: ReturnType<typeof setTimeout> | null = null
let bound = false

/**
 * Глобальный сброс скринлока при смене аккаунта / выходе.
 *
 * Чинит баг: вышел из A (локер включён), зашёл в B (локер выключен) —
 * через 5 минут прилетал чужой таймер и лочил экран B.
 * Причина — модульный синглтон хранил enabled/timeout/cachedCode юзера A,
 * а useAuthSession его не сбрасывал.
 */
export function resetScreenLockSession(): void {
  disarm()
  locked.value = false
  enabled.value = false
  cachedCode = null
  initialized.value = false
  lastPoke = 0
  error.value = null
  clearServerEnabled()
  writeMirror(false, timeoutMin.value, kind.value)
  broadcastLockState()
  void kvDel(CODE_KEY).catch(() => {})
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

async function readLocal(): Promise<{ code: string | null; timeout: number; kind: LockKind }> {
  const [code, t, k] = await Promise.all([kvGet(CODE_KEY), kvGet(TIMEOUT_KEY), kvGet(KIND_KEY)])
  return { code, timeout: Number(t ?? 5) || 5, kind: normalizeKind(k) }
}

async function writeLocal(code: string | null, timeout: number, kind: LockKind): Promise<void> {
  writeMirror(!!code, timeout, kind)
  if (code) await kvSet(CODE_KEY, code)
  else await kvDel(CODE_KEY)
  await kvSet(TIMEOUT_KEY, String(timeout))
  await kvSet(KIND_KEY, kind)
}

export function useScreenLock() {
  const isActive = computed(() => enabled.value)
  const isLocked = computed(() => enabled.value && locked.value)

  async function init() {
    bind()
    if (initialized.value) {
      arm()
      return
    }
    // Быстрый путь без сети: зеркало из localStorage применяется после
    // монтирования, а не при импорте модуля — первый рендер клиента
    // совпадает с SSR (mismatch в шапке исключён), актуальные значения
    // всё равно придут из load() ниже.
    if (typeof window !== 'undefined') {
      const mirror = readMirror()
      enabled.value = mirror.enabled
      timeoutMin.value = mirror.timeout
      kind.value = mirror.kind
    }
    await load()
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const fetchedState = await fetchScreenLock()
      offline.value = false
      enabled.value = fetchedState.enabled
      timeoutMin.value = fetchedState.timeout
      kind.value = fetchedState.kind
      writeServerEnabled(fetchedState.enabled)
      const localState = await readLocal()
      const hasServerCode = fetchedState.enabled
      cachedCode = hasServerCode ? localState.code : null
      if (hasServerCode) {
        await kvSet(TIMEOUT_KEY, String(fetchedState.timeout))
        await kvSet(KIND_KEY, fetchedState.kind)
      } else {
        await kvDel(CODE_KEY)
        await kvSet(TIMEOUT_KEY, String(fetchedState.timeout))
        await kvSet(KIND_KEY, fetchedState.kind)
      }
    } catch (e: any) {
      offline.value = true
      const local = await readLocal()
      if (e?.response?.status === 401) {
        cachedCode = null
        enabled.value = false
        clearServerEnabled()
        await kvDel(CODE_KEY)
      } else if (readServerEnabled() === false) {
        cachedCode = null
        enabled.value = false
        await kvDel(CODE_KEY)
      } else {
        cachedCode = local.code
        enabled.value = !!local.code
      }
      timeoutMin.value = local.timeout
      kind.value = local.kind
    } finally {
      loading.value = false
      initialized.value = true
    }
    locked.value = false
    writeMirror(enabled.value, timeoutMin.value, kind.value)
    broadcastLockState()
    arm()
  }

  async function save(code: string, timeout: number, nextKind?: LockKind) {
    const k = nextKind ?? kind.value
    saving.value = true
    error.value = null
    try {
      await writeLocal(code, timeout, k)
      try {
        const s = await saveScreenLock(code, timeout, k)
        offline.value = false
        enabled.value = s.enabled
        timeoutMin.value = s.timeout
        kind.value = s.kind
      } catch (e: any) {
        if (e?.response) throw e
        offline.value = true
        writeServerEnabled(true)
        enabled.value = true
        timeoutMin.value = timeout
        kind.value = k
      }
      cachedCode = code
      locked.value = false
      broadcastLockState()
      arm()
    } catch {
      error.value = 'Не удалось сохранить код'
    } finally {
      saving.value = false
    }
  }

  async function changeTimeout(timeout: number) {
    if (!cachedCode) {
      error.value = 'Введи код, чтобы сменить таймаут'
      return
    }
    await save(cachedCode, timeout, kind.value)
  }

  async function remove() {
    saving.value = true
    error.value = null
    try {
      try {
        await clearScreenLock()
        offline.value = false
      } catch (e: any) {
        if (e?.response) throw e
        offline.value = true
      }
      writeServerEnabled(false)
      await writeLocal(null, timeoutMin.value, kind.value)
    } catch {
      error.value = 'Не удалось выключить'
    } finally {
      saving.value = false
    }
    cachedCode = null
    enabled.value = false
    locked.value = false
    broadcastLockState()
    disarm()
  }

  async function verify(input: string): Promise<boolean> {
    verifying.value = true
    error.value = null
    try {
      try {
        const ok = await verifyScreenLock(input)
        offline.value = false
        if (ok) {
          cachedCode = input
          await writeLocal(input, timeoutMin.value, kind.value)
        } else {
          error.value = 'Неверный код'
          return false
        }
      } catch (e: any) {
        if (e?.response) throw e
        offline.value = true
        if (!cachedCode) {
          const local = await readLocal()
          cachedCode = local.code
        }
        if (!cachedCode || cachedCode !== input) {
          error.value = !cachedCode ? 'Нет соединения — код недоступен на этом устройстве' : 'Неверный код'
          return false
        }
      }
      locked.value = false
      broadcastLockState()
      arm()
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
  return {
    enabled: isActive,
    timeoutMin,
    kind,
    locked: isLocked,
    loading,
    saving,
    verifying,
    error,
    offline,
    initialized,
    init,
    load,
    save,
    changeTimeout,
    remove,
    verify,
    lockNow,
    poke,
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
