import type { Profile } from '../types'
import { ACTIVE_PROFILE_KEY, now, openDb, readMeta, writeMeta } from './db'
import { clearPrefs } from './prefs'
import { clearProfileProgress } from './progress'

const FIRST_PROFILE_NAME = 'Me'

export async function listProfiles(): Promise<Profile[]> {
  const db = await openDb()
  const stored = await db.getAll('profiles')
  if (stored.length) return stored.map(({ id, name }) => ({ id, name }))

  const first = { id: crypto.randomUUID(), name: FIRST_PROFILE_NAME }
  await db.put('profiles', { ...first, updatedAt: now() })
  await writeMeta(ACTIVE_PROFILE_KEY, first.id)
  return [first]
}

export async function activeProfile(): Promise<Profile> {
  const profiles = await listProfiles()
  const activeId = await readMeta<string | null>(ACTIVE_PROFILE_KEY, null)
  return profiles.find(profile => profile.id === activeId) ?? profiles[0]!
}

export async function setActiveProfile(id: string): Promise<void> {
  const profiles = await listProfiles()
  if (profiles.some(profile => profile.id === id)) await writeMeta(ACTIVE_PROFILE_KEY, id)
}

export async function createProfile(name: string): Promise<Profile> {
  await listProfiles()
  const profile = { id: crypto.randomUUID(), name: name.trim() || FIRST_PROFILE_NAME }
  await (await openDb()).put('profiles', { ...profile, updatedAt: now() })
  return profile
}

export async function renameProfile(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const db = await openDb()
  const existing = await db.get('profiles', id)
  if (!existing) return
  await db.put('profiles', { ...existing, name: trimmed, updatedAt: now() })
}

export async function deleteProfile(id: string): Promise<boolean> {
  const profiles = await listProfiles()
  if (profiles.length < 2 || !profiles.some(profile => profile.id === id)) return false

  const db = await openDb()
  await db.delete('profiles', id)
  await clearProfileProgress(id)
  await clearPrefs(id)

  const active = await readMeta<string | null>(ACTIVE_PROFILE_KEY, null)
  if (active === id) await writeMeta(ACTIVE_PROFILE_KEY, profiles.find(profile => profile.id !== id)!.id)
  return true
}
