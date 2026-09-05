import type { Progress } from '../types'
import { now, openDb, toPlain } from './db'

export async function loadProgress(profileId: string): Promise<Progress> {
  const db = await openDb()
  const [completedRows, assignmentRows] = await Promise.all([
    db.getAllFromIndex('progress', 'byProfile', profileId),
    db.getAllFromIndex('assignments', 'byProfile', profileId),
  ])

  return {
    completed: Object.fromEntries(completedRows.map(row => [row.itemKey, row.completedOn])),
    assignments: Object.fromEntries(assignmentRows.map(row => [row.period, row.itemKey])),
  }
}

export async function markCompleted(profileId: string, itemKey: string, completedOn: string): Promise<void> {
  await (await openDb()).put('progress', { profileId, itemKey, completedOn, updatedAt: now() })
}

export async function assignForPeriod(profileId: string, period: string, itemKey: string): Promise<void> {
  await (await openDb()).put('assignments', { profileId, period, itemKey, updatedAt: now() })
}

export async function clearProfileProgress(profileId: string): Promise<void> {
  const db = await openDb()
  const transaction = db.transaction(['progress', 'assignments'], 'readwrite')
  const [completedKeys, assignmentKeys] = await Promise.all([
    transaction.objectStore('progress').index('byProfile').getAllKeys(profileId),
    transaction.objectStore('assignments').index('byProfile').getAllKeys(profileId),
  ])

  await Promise.all([
    ...completedKeys.map(key => transaction.objectStore('progress').delete(key)),
    ...assignmentKeys.map(key => transaction.objectStore('assignments').delete(key)),
    transaction.done,
  ])
}

export async function replaceProgress(profileId: string, progress: Progress): Promise<void> {
  await clearProfileProgress(profileId)
  const db = await openDb()
  const transaction = db.transaction(['progress', 'assignments'], 'readwrite')
  const stamp = now()

  await Promise.all([
    ...Object.entries(toPlain(progress).completed).map(([itemKey, completedOn]) =>
      transaction.objectStore('progress').put({ profileId, itemKey, completedOn, updatedAt: stamp })),
    ...Object.entries(toPlain(progress).assignments).map(([period, itemKey]) =>
      transaction.objectStore('assignments').put({ profileId, period, itemKey, updatedAt: stamp })),
    transaction.done,
  ])
}
