import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cachedKeys, clearClips, CLIP_LIMIT, clipCacheSize, clipsForText, getClip, putClip } from './audioClips'
import { closeDb, DB_NAME, DB_VERSION, openDb } from './db'
import { loadLibrary, saveToLibrary } from './library'
import { listProfiles } from './profiles'

const clip = (key: string, text = 'Sing now.') => ({
  key, text, blob: new Blob([key], { type: 'audio/mpeg' }), durationSeconds: 1.5,
})

beforeEach(async () => {
  await closeDb()
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

afterEach(() => closeDb())

describe('the audio clip store', () => {
  it('round-trips a blob, which is the whole reason it exists', async () => {
    await putClip(clip('gemini|Sing now.|Kore'))
    const stored = await getClip('gemini|Sing now.|Kore')

    expect(stored?.blob).toBeInstanceOf(Blob)
    expect(await stored!.blob.text()).toBe('gemini|Sing now.|Kore')
    expect(stored?.durationSeconds).toBe(1.5)
  })

  it('reports nothing for a key it has never seen', async () => {
    expect(await getClip('missing')).toBeUndefined()
  })

  it('answers which of a batch of keys are already cached', async () => {
    await putClip(clip('one'))
    await putClip(clip('three'))

    expect(await cachedKeys(['one', 'two', 'three'])).toEqual(new Set(['one', 'three']))
  })

  it('finds every voice recorded for one sentence', async () => {
    await putClip(clip('kore', 'Sing now.'))
    await putClip(clip('puck', 'Sing now.'))
    await putClip(clip('other', 'Dance now.'))

    expect((await clipsForText('Sing now.')).map(found => found.key).sort()).toEqual(['kore', 'puck'])
  })

  it('drops the oldest clips once the cap is passed', async () => {
    const db = await openDb()
    for (let index = 0; index < CLIP_LIMIT; index++) {
      await db.put('clips', { ...clip(`old-${index}`), bytes: 1, updatedAt: index + 1 })
    }

    await putClip(clip('newest'))

    expect(await db.count('clips')).toBe(CLIP_LIMIT)
    expect(await getClip('old-0')).toBeUndefined()
    expect(await getClip('newest')).toBeDefined()
  })

  it('measures itself so the size can be shown before clearing', async () => {
    await putClip(clip('one'))
    await putClip(clip('two'))

    const { count, bytes } = await clipCacheSize()
    expect(count).toBe(2)
    expect(bytes).toBeGreaterThan(0)

    await clearClips()
    expect(await clipCacheSize()).toEqual({ count: 0, bytes: 0 })
  })
})

describe('upgrading a version 2 database', () => {
  it('keeps what was stored and adds the clips store', async () => {
    const v2 = await openDB(DB_NAME, 2, {
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
      },
    })
    await v2.put('profiles', { id: 'p1', name: 'Sang', updatedAt: 1 })
    v2.close()

    const upgraded = await openDb()
    expect(upgraded.version).toBe(DB_VERSION)
    expect(upgraded.objectStoreNames).toContain('clips')
    expect((await listProfiles()).map(profile => profile.name)).toEqual(['Sang'])

    await saveToLibrary({ theme: 'Rumi', accent: 'GA', sentences: [], anchors: {} })
    expect(await loadLibrary()).toHaveLength(1)
  })
})
