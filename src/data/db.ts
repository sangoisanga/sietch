import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Settings } from '../core/settings'
import type { Drill, Profile } from '../types'

export const DB_NAME = 'drill-forge'
export const DB_VERSION = 2

export const ACTIVE_PROFILE_KEY = 'activeProfile'

export interface Timestamped {
  updatedAt: number
}

export interface ProfileRecord extends Profile, Timestamped {}

export interface ProgressRecord extends Timestamped {
  profileId: string
  itemKey: string
  completedOn: string
}

export interface AssignmentRecord extends Timestamped {
  profileId: string
  period: string
  itemKey: string
}

export interface PoolRecord extends Timestamped {
  id: string
  title: string
  cadence: 'daily' | 'weekly'
  version: number
  packIds: string[]
  author?: string
  license?: string
}

export interface PackRecord extends Timestamped {
  id: string
  poolId: string
  drill: Drill
}

export interface SettingsRecord extends Timestamped {
  id: 'settings'
  value: Settings
}

export interface LibraryRecord extends Timestamped {
  id: string
  drill: Drill
}

export interface ProfilePrefsRecord extends Timestamped {
  profileId: string
  shadowPace: number
}

export interface MetaRecord {
  key: string
  value: unknown
}

interface DrillForgeDB extends DBSchema {
  profiles: { key: string; value: ProfileRecord }
  progress: { key: [string, string]; value: ProgressRecord; indexes: { byProfile: string } }
  assignments: { key: [string, string]; value: AssignmentRecord; indexes: { byProfile: string } }
  pools: { key: string; value: PoolRecord }
  packs: { key: string; value: PackRecord; indexes: { byPool: string } }
  settings: { key: string; value: SettingsRecord }
  library: { key: string; value: LibraryRecord }
  meta: { key: string; value: MetaRecord }
  profilePrefs: { key: string; value: ProfilePrefsRecord }
}

export type DrillForgeDatabase = IDBPDatabase<DrillForgeDB>

function createProfilePrefsStore(db: DrillForgeDatabase): void {
  db.createObjectStore('profilePrefs', { keyPath: 'profileId' })
}

function createInitialStores(db: DrillForgeDatabase): void {
  db.createObjectStore('profiles', { keyPath: 'id' })
  db.createObjectStore('progress', { keyPath: ['profileId', 'itemKey'] })
    .createIndex('byProfile', 'profileId')
  db.createObjectStore('assignments', { keyPath: ['profileId', 'period'] })
    .createIndex('byProfile', 'profileId')
  db.createObjectStore('pools', { keyPath: 'id' })
  db.createObjectStore('packs', { keyPath: 'id' }).createIndex('byPool', 'poolId')
  db.createObjectStore('settings', { keyPath: 'id' })
  db.createObjectStore('library', { keyPath: 'id' })
  db.createObjectStore('meta', { keyPath: 'key' })
}

let connection: Promise<DrillForgeDatabase> | null = null

export function openDb(): Promise<DrillForgeDatabase> {
  connection ??= openDB<DrillForgeDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // one block per version step, never edited once shipped — someone's browser is still on it
      const database = db as unknown as DrillForgeDatabase
      if (oldVersion < 1) createInitialStores(database)
      if (oldVersion < 2) createProfilePrefsStore(database)
    },
  })
  return connection
}

export async function closeDb(): Promise<void> {
  if (!connection) return
  const db = await connection
  db.close()
  connection = null
}

// values arriving from the UI are reactive proxies, which neither structuredClone
// nor IndexedDB can clone; every write goes through here first
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

let lastStamp = 0

// strictly increasing: two writes in the same millisecond must not tie, or ordering
// and any future last-write-wins merge become arbitrary
export function now(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return lastStamp
}

export async function readMeta<T>(key: string, fallback: T): Promise<T> {
  const record = await (await openDb()).get('meta', key)
  return record === undefined ? fallback : record.value as T
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await (await openDb()).put('meta', { key, value })
}
