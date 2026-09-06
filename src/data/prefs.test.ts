import { openDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SHADOW_PACE } from '../core/shadow'
import { closeDb, DB_NAME, DB_VERSION, openDb } from './db'
import { loadPrefs, savePrefs } from './prefs'
import { activeProfile, createProfile, deleteProfile, listProfiles } from './profiles'
import { loadProgress } from './progress'
import { loadSettings } from './settings'

const wipe = () => new Promise<void>(resolve => {
  const request = indexedDB.deleteDatabase(DB_NAME)
  request.onsuccess = request.onerror = request.onblocked = () => resolve()
})

beforeEach(async () => {
  await closeDb()
  await wipe()
})

describe('profile preferences', () => {
  it('defaults to the pace v1 used', async () => {
    expect(await loadPrefs('unknown-profile')).toEqual({ shadowPace: DEFAULT_SHADOW_PACE })
  })

  it('round-trips per profile without leaking between them', async () => {
    const me = await activeProfile()
    const wife = await createProfile('Wife')

    await savePrefs(me.id, { shadowPace: 1.15 })
    await savePrefs(wife.id, { shadowPace: 2.5 })

    expect((await loadPrefs(me.id)).shadowPace).toBe(1.15)
    expect((await loadPrefs(wife.id)).shadowPace).toBe(2.5)
  })

  it('is dropped when the profile is deleted', async () => {
    const other = await createProfile('Other')
    await savePrefs(other.id, { shadowPace: 2 })
    await deleteProfile(other.id)
    expect((await loadPrefs(other.id)).shadowPace).toBe(DEFAULT_SHADOW_PACE)
  })

  it('stamps the row so a later sync can merge it', async () => {
    const me = await activeProfile()
    await savePrefs(me.id, { shadowPace: 2 })
    const record = await (await openDb()).get('profilePrefs', me.id)
    expect(record?.updatedAt).toBeGreaterThan(0)
  })
})

describe('upgrading a version 1 database', () => {
  it('keeps profiles, progress and settings, and adds the new store', async () => {
    // build a real v1 database, exactly as a browser that ran the previous release would hold it
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' })
        db.createObjectStore('progress', { keyPath: ['profileId', 'itemKey'] }).createIndex('byProfile', 'profileId')
        db.createObjectStore('assignments', { keyPath: ['profileId', 'period'] }).createIndex('byProfile', 'profileId')
        db.createObjectStore('pools', { keyPath: 'id' })
        db.createObjectStore('packs', { keyPath: 'id' }).createIndex('byPool', 'poolId')
        db.createObjectStore('settings', { keyPath: 'id' })
        db.createObjectStore('library', { keyPath: 'id' })
        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
    await v1.put('profiles', { id: 'p1', name: 'Sang', updatedAt: 1 })
    await v1.put('progress', { profileId: 'p1', itemKey: 'passage:rumi', completedOn: '2026-09-04', updatedAt: 1 })
    await v1.put('settings', { id: 'settings', value: { voice: 'Puck' }, updatedAt: 1 })
    v1.close()

    const upgraded = await openDb()
    expect(upgraded.version).toBe(DB_VERSION)
    expect(upgraded.objectStoreNames).toContain('profilePrefs')
    expect((await listProfiles()).map(profile => profile.name)).toEqual(['Sang'])
    expect((await loadProgress('p1')).completed).toEqual({ 'passage:rumi': '2026-09-04' })
    expect((await loadSettings()).providers.gemini!.voice).toBe('Puck')
    expect((await loadPrefs('p1')).shadowPace).toBe(DEFAULT_SHADOW_PACE)
  })
})
