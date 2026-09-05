export interface Profile {
  id: string
  name: string
}

export interface Progress {
  completed: Record<string, string>
  assignments: Record<string, string>
}

export interface ProfileExport {
  version: 1
  profile: Profile
  progress: Progress
}

const PROFILES_KEY = 'df_profiles'
const ACTIVE_KEY = 'df_active_profile'
const progressKey = (id: string) => `df_progress_${id}`

const EXPORT_VERSION = 1
const FIRST_PROFILE_NAME = 'Me'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked or full — the session continues, it just will not persist
  }
}

function isProfile(value: unknown): value is Profile {
  const profile = value as Profile | null
  return Boolean(profile && typeof profile.id === 'string' && typeof profile.name === 'string')
}

function toProgress(value: unknown): Progress {
  const source = value as Partial<Progress> | null
  const record = (field: unknown): Record<string, string> =>
    field && typeof field === 'object' ? field as Record<string, string> : {}
  return { completed: record(source?.completed), assignments: record(source?.assignments) }
}

function storedProfiles(): Profile[] {
  return read<unknown[]>(PROFILES_KEY, []).filter(isProfile)
}

export function listProfiles(): Profile[] {
  const profiles = storedProfiles()
  if (profiles.length) return profiles

  const first = { id: crypto.randomUUID(), name: FIRST_PROFILE_NAME }
  write(PROFILES_KEY, [first])
  write(ACTIVE_KEY, first.id)
  return [first]
}

export function activeProfile(): Profile {
  const profiles = listProfiles()
  const activeId = read<string | null>(ACTIVE_KEY, null)
  return profiles.find(profile => profile.id === activeId) ?? profiles[0]!
}

export function setActiveProfile(id: string): void {
  if (listProfiles().some(profile => profile.id === id)) write(ACTIVE_KEY, id)
}

export function createProfile(name: string): Profile {
  const profile = { id: crypto.randomUUID(), name: name.trim() || FIRST_PROFILE_NAME }
  write(PROFILES_KEY, [...listProfiles(), profile])
  return profile
}

export function renameProfile(id: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  write(PROFILES_KEY, listProfiles().map(profile => profile.id === id ? { ...profile, name: trimmed } : profile))
}

export function deleteProfile(id: string): boolean {
  const profiles = listProfiles()
  if (profiles.length < 2) return false

  const remaining = profiles.filter(profile => profile.id !== id)
  if (remaining.length === profiles.length) return false

  write(PROFILES_KEY, remaining)
  try {
    localStorage.removeItem(progressKey(id))
  } catch {
    // nothing to clean up if storage is unavailable
  }
  if (activeProfile().id === id) write(ACTIVE_KEY, remaining[0]!.id)
  return true
}

export function loadProgress(id: string): Progress {
  return toProgress(read<unknown>(progressKey(id), null))
}

export function saveProgress(id: string, progress: Progress): void {
  write(progressKey(id), progress)
}

export function exportProfile(id: string): ProfileExport {
  const profile = listProfiles().find(candidate => candidate.id === id) ?? activeProfile()
  return { version: EXPORT_VERSION, profile, progress: loadProgress(profile.id) }
}

export function importProfile(json: string): Profile {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('That file is not valid JSON.')
  }

  const payload = parsed as Partial<ProfileExport>
  if (payload.version !== EXPORT_VERSION) throw new Error(`Unsupported export version: ${String(payload.version)}`)
  if (!isProfile(payload.profile)) throw new Error('That file has no profile in it.')

  // a fresh id, so importing someone else's file cannot overwrite a profile already here
  const imported = { id: crypto.randomUUID(), name: payload.profile.name }
  write(PROFILES_KEY, [...listProfiles(), imported])
  saveProgress(imported.id, toProgress(payload.progress))
  return imported
}
