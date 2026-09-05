import { DEFAULT_SHADOW_PACE } from '../core/shadow'
import { now, openDb } from './db'

export interface ProfilePrefs {
  shadowPace: number
}

export const DEFAULT_PREFS: ProfilePrefs = { shadowPace: DEFAULT_SHADOW_PACE }

export async function loadPrefs(profileId: string): Promise<ProfilePrefs> {
  const record = await (await openDb()).get('profilePrefs', profileId)
  // an absent row means a profile from before this feature, which kept the default pace
  return { ...DEFAULT_PREFS, shadowPace: record?.shadowPace ?? DEFAULT_PREFS.shadowPace }
}

export async function savePrefs(profileId: string, prefs: ProfilePrefs): Promise<void> {
  await (await openDb()).put('profilePrefs', { profileId, ...prefs, updatedAt: now() })
}

export async function clearPrefs(profileId: string): Promise<void> {
  await (await openDb()).delete('profilePrefs', profileId)
}
