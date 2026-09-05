import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { drawForPeriod } from '../content/rotation'
import type { Pool } from '../content/pool'
import { DEFAULT_SETTINGS } from '../core/settings'
import type { Drill } from '../types'
import { closeDb, DB_NAME, openDb } from './db'
import { loadLibrary, removeFromLibrary, saveToLibrary } from './library'
import { migrateFromLocalStorage, MIGRATION_MARKER } from './migrate'
import { exportProfile, importProfile } from './profileTransfer'
import { activeProfile, createProfile, deleteProfile, listProfiles, renameProfile, setActiveProfile } from './profiles'
import { assignForPeriod, loadProgress, markCompleted, replaceProgress } from './progress'
import { loadSettings, saveSettings } from './settings'

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() { return entries.size },
    key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, String(value)) },
    removeItem: key => { entries.delete(key) },
    clear: () => entries.clear(),
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true })

const drill = (theme: string): Drill => ({
  theme, accent: 'GA', sentences: [{ en: 'Sing now.', ipa: '/ˈsɪŋ ˈnaʊ/', vi: 'Hát đi.', tips: [] }], anchors: {},
})

beforeEach(async () => {
  localStorage.clear()
  await closeDb()
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

afterEach(() => closeDb())

describe('profiles', () => {
  it('creates a first profile so the app is never profile-less', async () => {
    expect(await listProfiles()).toHaveLength(1)
    expect((await activeProfile()).name).toBe('Me')
  })

  it('creates, renames, switches and deletes', async () => {
    const wife = await createProfile('Wife')
    await setActiveProfile(wife.id)
    expect((await activeProfile()).id).toBe(wife.id)

    await renameProfile(wife.id, 'Linh')
    expect((await activeProfile()).name).toBe('Linh')

    expect(await deleteProfile(wife.id)).toBe(true)
    expect(await listProfiles()).toHaveLength(1)
  })

  it('refuses to delete the last profile', async () => {
    expect(await deleteProfile((await activeProfile()).id)).toBe(false)
  })

  it('ignores a rename to blank', async () => {
    const me = await activeProfile()
    await renameProfile(me.id, '   ')
    expect((await activeProfile()).name).toBe('Me')
  })
})

describe('progress', () => {
  it('keeps rows namespaced per profile', async () => {
    const me = await activeProfile()
    const other = await createProfile('Other')

    await markCompleted(me.id, 'passage:rumi', '2026-09-05')
    await markCompleted(other.id, 'passage:floyd', '2026-09-05')

    expect(Object.keys((await loadProgress(me.id)).completed)).toEqual(['passage:rumi'])
    expect(Object.keys((await loadProgress(other.id)).completed)).toEqual(['passage:floyd'])
  })

  it('stamps every row so a later sync can merge by recency', async () => {
    const me = await activeProfile()
    await markCompleted(me.id, 'passage:rumi', '2026-09-05')
    await assignForPeriod(me.id, '2026-09-05', 'passage:rumi')

    const db = await openDb()
    for (const row of await db.getAll('progress')) expect(row.updatedAt).toBeGreaterThan(0)
    for (const row of await db.getAll('assignments')) expect(row.updatedAt).toBeGreaterThan(0)
  })

  it('rebuilds the shape rotation expects', async () => {
    const me = await activeProfile()
    await markCompleted(me.id, 'passage:rumi', '2026-09-04')
    await assignForPeriod(me.id, '2026-09-05', 'passage:floyd')

    const pool: Pool = {
      id: 'daily', title: 'Daily', cadence: 'daily',
      items: [{ kind: 'passage', packId: 'rumi' }, { kind: 'passage', packId: 'floyd' }],
    }
    expect(drawForPeriod(pool, await loadProgress(me.id), '2026-09-05', me.id)).toEqual({ kind: 'passage', packId: 'floyd' })
  })

  it('drops a deleted profile\'s rows', async () => {
    const other = await createProfile('Other')
    await markCompleted(other.id, 'passage:rumi', '2026-09-05')
    await deleteProfile(other.id)
    expect(await loadProgress(other.id)).toEqual({ completed: {}, assignments: {} })
  })
})

describe('settings', () => {
  it('round-trips and falls back to defaults', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS)
    await saveSettings({ ...DEFAULT_SETTINGS, voice: 'Puck', rate: 0.75 })
    expect(await loadSettings()).toMatchObject({ voice: 'Puck', rate: 0.75 })
  })

  it('backfills keys an older stored shape is missing', async () => {
    await (await openDb()).put('settings', { id: 'settings', value: { voice: 'Puck' } as never, updatedAt: 1 })
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, voice: 'Puck' })
  })
})

describe('library', () => {
  it('stores newest first and deletes by id', async () => {
    await saveToLibrary(drill('Rumi'))
    await saveToLibrary(drill('Pink Floyd'))
    const entries = await loadLibrary()
    expect(entries.map(entry => entry.theme)).toEqual(['Pink Floyd', 'Rumi'])

    await removeFromLibrary(entries[0]!.entryId)
    expect((await loadLibrary()).map(entry => entry.theme)).toEqual(['Rumi'])
  })

  it('caps at 30 entries', async () => {
    for (let i = 0; i < 35; i++) await saveToLibrary(drill(`pack ${i}`))
    expect(await loadLibrary()).toHaveLength(30)
  })

  it('deep-copies so later edits cannot reach the stored entry', async () => {
    const original = drill('Rumi')
    await saveToLibrary(original)
    original.theme = 'edited'
    expect((await loadLibrary())[0]!.theme).toBe('Rumi')
  })
})

describe('export and import', () => {
  it('round-trips progress under a fresh id', async () => {
    const me = await activeProfile()
    await renameProfile(me.id, 'Sang')
    await markCompleted(me.id, 'passage:rumi', '2026-09-05')

    const imported = await importProfile(JSON.stringify(await exportProfile(me.id)))

    expect(imported.name).toBe('Sang')
    expect(imported.id).not.toBe(me.id)
    expect((await loadProgress(imported.id)).completed).toEqual({ 'passage:rumi': '2026-09-05' })
    expect((await loadProgress(me.id)).completed).toEqual({ 'passage:rumi': '2026-09-05' })
  })

  const rejections = [
    { name: 'a wrong version', json: JSON.stringify({ version: 2, profile: { id: 'x', name: 'y' } }), message: /Unsupported export version: 2/ },
    { name: 'a missing profile', json: JSON.stringify({ version: 1 }), message: /no profile/ },
    { name: 'malformed json', json: '{not json', message: /not valid JSON/ },
  ]

  for (const { name, json, message } of rejections) {
    it(`rejects ${name}`, async () => { await expect(importProfile(json)).rejects.toThrow(message) })
  }
})

describe('migration from localStorage', () => {
  const seedV1 = () => {
    localStorage.setItem('df_profiles', JSON.stringify([{ id: 'p1', name: 'Sang' }, { id: 'p2', name: 'Wife' }]))
    localStorage.setItem('df_active_profile', JSON.stringify('p2'))
    localStorage.setItem('df_progress_p1', JSON.stringify({ completed: { 'passage:rumi': '2026-09-04' }, assignments: { '2026-09-04': 'passage:rumi' } }))
    localStorage.setItem('df_progress_p2', JSON.stringify({ completed: { 'passage:floyd': '2026-09-05' }, assignments: {} }))
    localStorage.setItem('df_settings', JSON.stringify({ voice: 'Puck' }))
    localStorage.setItem('df_lib', JSON.stringify([drill('Saved one')]))
  }

  it('moves every key and leaves the originals in place', async () => {
    seedV1()
    const report = await migrateFromLocalStorage()

    expect(report).toEqual({ ran: true, profiles: 2, progressRows: 2, settings: true, libraryEntries: 1 })
    expect((await listProfiles()).map(p => p.name).sort()).toEqual(['Sang', 'Wife'])
    expect((await activeProfile()).id).toBe('p2')
    expect((await loadProgress('p1')).completed).toEqual({ 'passage:rumi': '2026-09-04' })
    expect((await loadProgress('p1')).assignments).toEqual({ '2026-09-04': 'passage:rumi' })
    expect(await loadSettings()).toMatchObject({ voice: 'Puck' })
    expect(await loadLibrary()).toHaveLength(1)
    expect(localStorage.getItem('df_profiles')).not.toBeNull()
  })

  it('is a no-op on the second run', async () => {
    seedV1()
    await migrateFromLocalStorage()
    expect((await migrateFromLocalStorage()).ran).toBe(false)
    expect(await listProfiles()).toHaveLength(2)
  })

  it('marks itself done so a later run is skipped', async () => {
    await migrateFromLocalStorage()
    expect(await (await openDb()).get('meta', MIGRATION_MARKER)).toMatchObject({ value: true })
  })

  it('survives a corrupt library without losing profiles', async () => {
    seedV1()
    localStorage.setItem('df_lib', '{not json')

    const report = await migrateFromLocalStorage()
    expect(report.profiles).toBe(2)
    expect(report.libraryEntries).toBe(0)
  })

  it('skips entries that are not profiles', async () => {
    localStorage.setItem('df_profiles', JSON.stringify([{ nope: true }, { id: 'p1', name: 'Sang' }]))
    expect((await migrateFromLocalStorage()).profiles).toBe(1)
  })

  it('reports nothing when there is no v1 data', async () => {
    expect((await migrateFromLocalStorage()).profiles).toBe(0)
  })
})

describe('replaceProgress', () => {
  it('clears what was there before', async () => {
    const me = await activeProfile()
    await markCompleted(me.id, 'passage:old', '2026-01-01')
    await replaceProgress(me.id, { completed: { 'passage:new': '2026-09-05' }, assignments: {} })
    expect((await loadProgress(me.id)).completed).toEqual({ 'passage:new': '2026-09-05' })
  })
})

describe('writes accept reactive proxies', () => {
  // Svelte 5 $state values are Proxy objects, which structuredClone and IndexedDB both refuse
  const reactive = <T extends object>(value: T): T => new Proxy(value, {})

  it('structuredClone genuinely rejects a proxy, so this guard is load-bearing', () => {
    expect(() => structuredClone(reactive({ a: 1 }))).toThrow()
  })

  it('saves a proxied drill to the library', async () => {
    await saveToLibrary(reactive(drill('Rumi')))
    expect((await loadLibrary())[0]!.theme).toBe('Rumi')
  })

  it('saves proxied settings', async () => {
    await saveSettings(reactive({ ...DEFAULT_SETTINGS, voice: 'Puck' }))
    expect((await loadSettings()).voice).toBe('Puck')
  })

  it('replaces progress from a proxied object', async () => {
    const me = await activeProfile()
    await replaceProgress(me.id, reactive({ completed: { 'passage:rumi': '2026-09-05' }, assignments: {} }))
    expect((await loadProgress(me.id)).completed).toEqual({ 'passage:rumi': '2026-09-05' })
  })
})
