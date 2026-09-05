import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import type { Drill, Profile, Progress } from '../types'
import { now, openDb, readMeta, writeMeta, ACTIVE_PROFILE_KEY } from './db'

export const MIGRATION_MARKER = 'migrated:localStorage@1'

export interface MigrationReport {
  ran: boolean
  profiles: number
  progressRows: number
  settings: boolean
  libraryEntries: number
}

const NOTHING_MIGRATED: MigrationReport = { ran: false, profiles: 0, progressRows: 0, settings: false, libraryEntries: 0 }

function readKey<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw) as T
  } catch {
    return null
  }
}

function isProfile(value: unknown): value is Profile {
  const profile = value as Profile | null
  return Boolean(profile && typeof profile.id === 'string' && typeof profile.name === 'string')
}

function isDrill(value: unknown): value is Drill {
  const drill = value as Drill | null
  return Boolean(drill && typeof drill.theme === 'string' && Array.isArray(drill.sentences))
}

function record(field: unknown): Record<string, string> {
  return field && typeof field === 'object' ? field as Record<string, string> : {}
}

// v1 kept everything in localStorage; the originals are left in place as a safety net
export async function migrateFromLocalStorage(): Promise<MigrationReport> {
  if (typeof localStorage === 'undefined') return NOTHING_MIGRATED
  if (await readMeta(MIGRATION_MARKER, false)) return NOTHING_MIGRATED

  const db = await openDb()
  const stamp = now()
  const report: MigrationReport = { ran: true, profiles: 0, progressRows: 0, settings: false, libraryEntries: 0 }

  const profiles = (readKey<unknown[]>('df_profiles') ?? []).filter(isProfile)
  for (const profile of profiles) {
    await db.put('profiles', { ...profile, updatedAt: stamp })
    report.profiles++

    const progress = readKey<Partial<Progress>>(`df_progress_${profile.id}`)
    for (const [itemKey, completedOn] of Object.entries(record(progress?.completed))) {
      await db.put('progress', { profileId: profile.id, itemKey, completedOn, updatedAt: stamp })
      report.progressRows++
    }
    for (const [period, itemKey] of Object.entries(record(progress?.assignments))) {
      await db.put('assignments', { profileId: profile.id, period, itemKey, updatedAt: stamp })
    }
  }

  const activeId = readKey<string>('df_active_profile')
  if (activeId && profiles.some(profile => profile.id === activeId)) await writeMeta(ACTIVE_PROFILE_KEY, activeId)

  const settings = readKey<Partial<Settings>>('df_settings')
  if (settings) {
    await db.put('settings', { id: 'settings', value: { ...DEFAULT_SETTINGS, ...settings }, updatedAt: stamp })
    report.settings = true
  }

  for (const drill of (readKey<unknown[]>('df_lib') ?? []).filter(isDrill)) {
    await db.put('library', { id: crypto.randomUUID(), drill, updatedAt: stamp })
    report.libraryEntries++
  }

  await writeMeta(MIGRATION_MARKER, true)
  return report
}
