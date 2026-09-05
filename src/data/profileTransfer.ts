import type { Profile, Progress } from '../types'
import { listProfiles } from './profiles'
import { loadProgress, replaceProgress } from './progress'
import { now, openDb } from './db'

export const TRANSFER_VERSION = 1

export interface ProfileExport {
  version: typeof TRANSFER_VERSION
  profile: Profile
  progress: Progress
}

function isProfile(value: unknown): value is Profile {
  const profile = value as Profile | null
  return Boolean(profile && typeof profile.id === 'string' && typeof profile.name === 'string')
}

export async function exportProfile(id: string): Promise<ProfileExport> {
  const profiles = await listProfiles()
  const profile = profiles.find(candidate => candidate.id === id) ?? profiles[0]!
  return { version: TRANSFER_VERSION, profile, progress: await loadProgress(profile.id) }
}

export async function importProfile(json: string): Promise<Profile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  const payload = parsed as Partial<ProfileExport>
  if (payload.version !== TRANSFER_VERSION) throw new Error(`Unsupported export version: ${String(payload.version)}`)
  if (!isProfile(payload.profile)) throw new Error('That file has no profile in it.')

  // a fresh id, so importing someone else's file cannot overwrite a profile already here
  const imported = { id: crypto.randomUUID(), name: payload.profile.name }
  await (await openDb()).put('profiles', { ...imported, updatedAt: now() })
  await replaceProgress(imported.id, {
    completed: payload.progress?.completed ?? {},
    assignments: payload.progress?.assignments ?? {},
  })
  return imported
}
