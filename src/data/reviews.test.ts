import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextReview, NEW_REVIEW } from '../core/srs'
import { closeDb, DB_NAME, DB_VERSION, openDb } from './db'
import { activeProfile, createProfile, deleteProfile } from './profiles'
import { loadProgress } from './progress'
import { loadReviews, saveReview } from './reviews'

beforeEach(async () => {
  await closeDb()
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

afterEach(() => closeDb())

describe('review rows', () => {
  it('round-trips a schedule per profile without leaking between them', async () => {
    const me = await activeProfile()
    const wife = await createProfile('Wife')

    await saveReview(me.id, 'passage:rumi', nextReview(NEW_REVIEW, 'good', '2026-09-06'))
    await saveReview(wife.id, 'passage:dylan', nextReview(NEW_REVIEW, 'easy', '2026-09-06'))

    expect(await loadReviews(me.id)).toEqual({
      'passage:rumi': { interval: 1, ease: 2.5, reps: 1, lapses: 0, due: '2026-09-07' },
    })
    expect(Object.keys(await loadReviews(wife.id))).toEqual(['passage:dylan'])
  })

  it('stamps the row so a later sync can merge it', async () => {
    const me = await activeProfile()
    await saveReview(me.id, 'passage:rumi', NEW_REVIEW)
    const record = await (await openDb()).get('reviews', [me.id, 'passage:rumi'])
    expect(record?.updatedAt).toBeGreaterThan(0)
  })

  it('goes when the profile goes', async () => {
    const other = await createProfile('Other')
    await saveReview(other.id, 'passage:rumi', NEW_REVIEW)
    await deleteProfile(other.id)
    expect(await loadReviews(other.id)).toEqual({})
  })
})

describe('upgrading a version 3 database', () => {
  it('keeps progress and clips, and adds the reviews store', async () => {
    const v3 = await openDB(DB_NAME, 3, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' })
        db.createObjectStore('progress', { keyPath: ['profileId', 'itemKey'] }).createIndex('byProfile', 'profileId')
        db.createObjectStore('assignments', { keyPath: ['profileId', 'period'] }).createIndex('byProfile', 'profileId')
        db.createObjectStore('pools', { keyPath: 'id' })
        db.createObjectStore('packs', { keyPath: 'id' }).createIndex('byPool', 'poolId')
        db.createObjectStore('settings', { keyPath: 'id' })
        db.createObjectStore('library', { keyPath: 'id' })
        db.createObjectStore('meta', { keyPath: 'key' })
        db.createObjectStore('profilePrefs', { keyPath: 'profileId' })
        const clips = db.createObjectStore('clips', { keyPath: 'key' })
        clips.createIndex('byText', 'text')
        clips.createIndex('byUpdated', 'updatedAt')
      },
    })
    await v3.put('profiles', { id: 'p1', name: 'Sang', updatedAt: 1 })
    await v3.put('progress', { profileId: 'p1', itemKey: 'passage:rumi', completedOn: '2026-09-04', updatedAt: 1 })
    await v3.put('clips', { key: 'k', text: 'Sing now.', blob: new Blob(['a']), bytes: 1, durationSeconds: 1, updatedAt: 1 })
    v3.close()

    const upgraded = await openDb()
    expect(upgraded.version).toBe(DB_VERSION)
    expect(upgraded.objectStoreNames).toContain('reviews')
    expect((await loadProgress('p1')).completed).toEqual({ 'passage:rumi': '2026-09-04' })
    expect(await upgraded.count('clips')).toBe(1)
    expect(await loadReviews('p1')).toEqual({})
  })
})
