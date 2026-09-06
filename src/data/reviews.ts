import type { ReviewState } from '../core/srs'
import { now, openDb } from './db'

export async function loadReviews(profileId: string): Promise<Record<string, ReviewState>> {
  const rows = await (await openDb()).getAllFromIndex('reviews', 'byProfile', profileId)
  return Object.fromEntries(rows.map(({ itemKey, interval, ease, reps, lapses, due }) =>
    [itemKey, { interval, ease, reps, lapses, due }]))
}

export async function saveReview(profileId: string, itemKey: string, state: ReviewState): Promise<void> {
  await (await openDb()).put('reviews', { ...state, profileId, itemKey, updatedAt: now() })
}

export async function clearProfileReviews(profileId: string): Promise<void> {
  const db = await openDb()
  const keys = await db.getAllKeysFromIndex('reviews', 'byProfile', profileId)
  await Promise.all(keys.map(key => db.delete('reviews', key)))
}
