import { beforeEach, describe, expect, it } from 'vitest'
import { signPool, type PoolFile } from '../content/poolFile'
import { putClip } from '../data/audioClips'
import { closeDb, DB_NAME } from '../data/db'
import { installPool } from '../data/pools'
import { providers } from './actions'
import { app, speakOptions } from './app.svelte'
import { listExercises, matchesSearch, type ExerciseEntry } from './exercises'

const sentence = (en: string) => ({ en, ipa: '', vi: '', tips: [] })

const twoPacks = (): Promise<PoolFile> => signPool({
  schema: 1,
  id: 'tiny',
  title: 'Tiny pool',
  version: 1,
  cadence: 'daily',
  updatedAt: '2026-09-06T00:00:00.000Z',
  packs: [
    { id: 'one', theme: 'Rumi', accent: 'GA', sentences: [sentence('Sing now.'), sentence('Dance now.')], anchors: {} },
    { id: 'two', theme: 'Dylan', accent: 'RP', sentences: [sentence('Blow, wind.')], anchors: {} },
  ],
})

const entry = (entries: ExerciseEntry[], title: string) => entries.find(found => found.title === title)!

beforeEach(async () => {
  await closeDb()
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })

  app.settings = { ...app.settings, ttsProviderId: 'gemini', providers: { gemini: { apiKey: 'k', voice: 'Kore' } } }
  app.profile = null
  app.library = []
  app.drill = { theme: 'Rumi', accent: 'GA', sentences: [], anchors: {} }
})

describe('listExercises', () => {
  it('lists pool packs and saved drills in one place', async () => {
    await installPool(await twoPacks())
    app.library = [{ entryId: 'saved-1', theme: 'My text', accent: 'GA', sentences: [sentence('Sing now.')], anchors: {} }]

    const entries = await listExercises()

    expect(entries.map(found => found.title).sort()).toEqual(['Dylan', 'My text', 'Rumi'])
    expect(entry(entries, 'Rumi').from).toEqual({ kind: 'pool', poolId: 'tiny', packId: 'one' })
    expect(entry(entries, 'My text').from).toEqual({ kind: 'library', entryId: 'saved-1' })
    expect(entry(entries, 'Dylan').accent).toBe('RP')
  })

  it('reports partial audio when only some sentences are cached', async () => {
    await installPool(await twoPacks())
    const { cacheKey } = providers.activeTts()
    const keyFor = (text: string, accent: 'GA' | 'RP') => {
      app.drill = { theme: '', accent, sentences: [], anchors: {} }
      return cacheKey!(text, speakOptions())
    }

    await putClip({ key: keyFor('Sing now.', 'GA'), text: 'Sing now.', blob: new Blob(['a']), durationSeconds: 1 })
    await putClip({ key: keyFor('Blow, wind.', 'RP'), text: 'Blow, wind.', blob: new Blob(['a']), durationSeconds: 1 })

    const entries = await listExercises()

    expect(entry(entries, 'Rumi').audio).toBe('partial')
    expect(entry(entries, 'Dylan').audio).toBe('ready')
  })

  it('reports no audio when the active voice cannot cache', async () => {
    app.settings = { ...app.settings, ttsProviderId: 'browser', providers: {} }
    await installPool(await twoPacks())

    expect((await listExercises()).every(found => found.audio === 'none')).toBe(true)
  })
})

describe('matchesSearch', () => {
  const rumi = { title: 'Rumi', accent: 'GA' } as ExerciseEntry

  it('matches on title and accent, ignoring case and padding', () => {
    expect(matchesSearch(rumi, '  RUM ')).toBe(true)
    expect(matchesSearch(rumi, 'ga')).toBe(true)
    expect(matchesSearch(rumi, '')).toBe(true)
    expect(matchesSearch(rumi, 'dylan')).toBe(false)
  })
})
