import type { StoredClip } from '../providers/tts/types'
import { now, openDb, type SietchDatabase } from './db'

// ponytail: a count cap, not a byte budget — Gemini returns WAV, so revisit if 600 clips get heavy
export const CLIP_LIMIT = 600

export async function getClip(key: string): Promise<StoredClip | undefined> {
  const record = await (await openDb()).get('clips', key)
  if (!record) return undefined
  return { key: record.key, text: record.text, blob: record.blob, durationSeconds: record.durationSeconds }
}

export async function putClip(clip: StoredClip): Promise<void> {
  const db = await openDb()
  try {
    await db.put('clips', { ...clip, bytes: clip.blob.size, updatedAt: now() })
  } catch {
    // a full or blocked cache must not break playback: the clip is already in memory and will play
    return
  }
  await trimOldest(db)
}

async function trimOldest(db: SietchDatabase): Promise<void> {
  const excess = await db.count('clips') - CLIP_LIMIT
  if (excess <= 0) return

  const stale = await db.getAllKeysFromIndex('clips', 'byUpdated', null, excess)
  await Promise.all(stale.map(key => db.delete('clips', key)))
}

export async function deleteClip(key: string): Promise<void> {
  await (await openDb()).delete('clips', key)
}

export async function cachedKeys(keys: string[]): Promise<Set<string>> {
  const db = await openDb()
  const found = await Promise.all(keys.map(async key => await db.getKey('clips', key) === undefined ? '' : key))
  return new Set(found.filter(Boolean))
}

export async function clipsForText(text: string): Promise<StoredClip[]> {
  const records = await (await openDb()).getAllFromIndex('clips', 'byText', text)
  return records.map(record => ({ key: record.key, text: record.text, blob: record.blob, durationSeconds: record.durationSeconds }))
}

export async function clipCacheSize(): Promise<{ count: number; bytes: number }> {
  const records = await (await openDb()).getAll('clips')
  return { count: records.length, bytes: records.reduce((sum, record) => sum + record.bytes, 0) }
}

export async function clearClips(): Promise<void> {
  await (await openDb()).clear('clips')
}
