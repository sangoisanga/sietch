import { beforeEach, describe, expect, it } from 'vitest'
import { signPool, type PoolFile } from '../content/poolFile'
import { dayKey } from '../core/period'
import { putClip } from '../data/audioClips'
import { closeDb, DB_NAME } from '../data/db'
import { installPool } from '../data/pools'
import { markCompleted } from '../data/progress'
import { saveReview } from '../data/reviews'
import { providers } from './actions'
import { app, exerciseItemKey, speakOptions } from './app.svelte'
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

describe('scheduling a saved drill', () => {
  const me = { id: 'p1', name: 'Me' }

  const inDays = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return dayKey(date)
  }

  const reviewDue = (due: string) => ({ interval: 3, ease: 2.5, reps: 1, lapses: 0, due })

  it('reports a real due date and completion date for a rated library entry', async () => {
    app.profile = me
    app.library = [{ entryId: 'saved-1', theme: 'My text', accent: 'GA', sentences: [sentence('Sing now.')], anchors: {} }]
    const key = exerciseItemKey({ kind: 'library', entryId: 'saved-1' })

    await saveReview(me.id, key, reviewDue(inDays(3)))
    await markCompleted(me.id, key, inDays(-1))

    const saved = entry(await listExercises(), 'My text')
    expect(saved.dueInDays).toBe(3)
    expect(saved.completedOn).toBe(inDays(-1))
  })

  // the key was never pool-prefixed, and prefixing it now would silently reset everyone's history
  it('leaves the pool key unprefixed, so review rows earned before this change still match', async () => {
    app.profile = me
    await installPool(await twoPacks())
    expect(exerciseItemKey({ kind: 'pool', poolId: 'tiny', packId: 'one' })).toBe('passage:one')

    await saveReview(me.id, 'passage:one', reviewDue(inDays(5)))

    expect(entry(await listExercises(), 'Rumi').dueInDays).toBe(5)
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
