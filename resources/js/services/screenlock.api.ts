import { api } from '@/services/api'

export interface ScreenLockState {
  enabled: boolean
  timeout: number
  kind: 'pin4' | 'alpha8'
}

export function normalizeKind(v: unknown): 'pin4' | 'alpha8' {
  return v === 'alpha8' ? 'alpha8' : 'pin4'
}

export async function fetchScreenLock(): Promise<ScreenLockState> {
  const { data } = await api.get('/api/user/screen-lock')
  return { enabled: !!data.enabled, timeout: Number(data.timeout ?? 5), kind: normalizeKind(data.kind) }
}

export async function saveScreenLock(code: string, timeout: number, kind: 'pin4' | 'alpha8'): Promise<ScreenLockState> {
  const { data } = await api.put('/api/user/screen-lock', { code, timeout, kind })
  return { enabled: !!data.enabled, timeout: Number(data.timeout ?? timeout), kind: normalizeKind(data.kind ?? kind) }
}

export async function clearScreenLock(): Promise<void> {
  await api.delete('/api/user/screen-lock')
}

export async function verifyScreenLock(code: string): Promise<boolean> {
  try {
    await api.post('/api/user/screen-lock/verify', { code })
    return true
  } catch (e: any) {
    if (!e?.response) throw e
    return false
  }
}
