import type { Drill } from '../types'
import { now, openDb, toPlain, type LibraryRecord } from './db'

const LIBRARY_LIMIT = 30

const newestFirst = (a: LibraryRecord, b: LibraryRecord) => b.updatedAt - a.updatedAt

export async function loadLibrary(): Promise<(Drill & { entryId: string })[]> {
  const records = await (await openDb()).getAll('library')
  return records.sort(newestFirst).map(record => ({ ...record.drill, entryId: record.id }))
}

export async function saveToLibrary(drill: Drill): Promise<void> {
  const db = await openDb()
  await db.put('library', { id: crypto.randomUUID(), drill: toPlain(drill), updatedAt: now() })

  const records = (await db.getAll('library')).sort(newestFirst)
  await Promise.all(records.slice(LIBRARY_LIMIT).map(record => db.delete('library', record.id)))
}

export async function removeFromLibrary(entryId: string): Promise<void> {
  await (await openDb()).delete('library', entryId)
}
