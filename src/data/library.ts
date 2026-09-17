import type { Drill } from '../types'
import { now, openDb, toPlain, type LibraryRecord } from './db'

const LIBRARY_LIMIT = 30

const newestFirst = (a: LibraryRecord, b: LibraryRecord) => b.updatedAt - a.updatedAt

export async function loadLibrary(): Promise<(Drill & { entryId: string })[]> {
  const records = await (await openDb()).getAll('library')
  return records.sort(newestFirst).map(record => ({ ...record.drill, entryId: record.id }))
}

export async function saveToLibrary(drill: Drill, rated: Set<string> = new Set()): Promise<string> {
  const db = await openDb()
  const id = crypto.randomUUID()
  await db.put('library', { id, drill: toPlain(drill), updatedAt: now() })

  const records = (await db.getAll('library')).sort(newestFirst)
  await Promise.all(records.slice(LIBRARY_LIMIT)
    .filter(record => !rated.has(record.id))
    .map(record => db.delete('library', record.id)))

  return id
}

export async function renameLibraryEntry(entryId: string, title: string): Promise<void> {
  const db = await openDb()
  const record = await db.get('library', entryId)
  if (!record) return
  await db.put('library', { ...record, drill: { ...record.drill, theme: title }, updatedAt: now() })
}

export async function removeFromLibrary(entryId: string): Promise<void> {
  await (await openDb()).delete('library', entryId)
}
