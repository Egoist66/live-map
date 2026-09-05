import Dexie, { type Table } from 'dexie'

interface KvRow {
  key: string
  value: string
}

class AppDb extends Dexie {
  kv!: Table<KvRow, string>

  constructor() {
    super('upin')
    this.version(1).stores({ kv: 'key' })
  }
}

export const appDb = new AppDb()

export async function kvGet(key: string): Promise<string | null> {
  try {
    const row = await appDb.kv.get(key)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    await appDb.kv.put({ key, value })
  } catch {}
}

export async function kvDel(key: string): Promise<void> {
  try {
    await appDb.kv.delete(key)
  } catch {}
}
