import { beforeEach, describe, expect, it } from 'vitest'
import { signPool } from '../content/poolFile'
import { putClip } from '../data/audioClips'
import { closeDb, DB_NAME } from '../data/db'
import { installPool } from '../data/pools'
import { providers, isLlmConfigured, openExercise, refreshAudioState, saveOpenDrill, themeFallback } from './actions'
import { app, speakOptions } from './app.svelte'

const sentence = (en: string) => ({ en, ipa: '', vi: '', tips: [] })

// v2 briefly wired providers through a setter nobody called, so every LLM path
// threw "Cannot read properties of undefined (reading 'activeLlm')"
describe('providers wiring', () => {
  it('is ready at module load, with no init call to remember', () => {
    expect(providers.activeLlm()).toBeDefined()
    expect(providers.activeTts()).toBeDefined()
  })

  it('answers isLlmConfigured without throwing when no key is set', () => {
    expect(isLlmConfigured()).toBe(false)
  })

  it('falls back to a theme when the input is blank', () => {
    expect(themeFallback('  ')).toBeTruthy()
  })
})

describe('audio state', () => {
  it('counts only the sentences with no clip saved for the active voice', async () => {
    app.settings = { ...app.settings, ttsProviderId: 'gemini', providers: { gemini: { apiKey: 'k', voice: 'Kore' } } }
    app.drill = {
      theme: 'Rumi', accent: 'GA', anchors: {},
      sentences: [sentence('Sing now.'), sentence('Dance now.')],
    }

    const { cacheKey } = providers.activeTts()
    await putClip({
      key: cacheKey!('Sing now.', speakOptions()),
      text: 'Sing now.',
      blob: new Blob(['audio']),
      durationSeconds: 1,
    })

    await refreshAudioState()

    expect(app.audioReady).toEqual(new Set(['Sing now.']))
    expect(app.missingAudio).toBe(1)
  })
})

describe('the open exercise', () => {
  beforeEach(async () => {
    await closeDb()
    await new Promise<void>(resolve => {
      const request = indexedDB.deleteDatabase(DB_NAME)
      request.onsuccess = request.onerror = request.onblocked = () => resolve()
    })

    app.profile = null
    app.library = []
    app.open = null
  })

  it('makes a saved passage the open exercise, so it can be rated without reopening it', async () => {
    app.drill = { theme: 'Rumi', accent: 'GA', anchors: {}, sentences: [sentence('Sing now.')] }

    await saveOpenDrill()

    expect(app.library).toHaveLength(1)
    expect(app.open).toEqual({ kind: 'library', entryId: app.library[0]!.entryId })
  })

  it('routes a poolId/packId id to the pack and a bare id to the library entry', async () => {
    await installPool(await signPool({
      schema: 1,
      id: 'tiny',
      title: 'Tiny pool',
      version: 1,
      cadence: 'daily',
      updatedAt: '2026-09-06T00:00:00.000Z',
      packs: [{ id: 'one', theme: 'Rumi', accent: 'GA', sentences: [sentence('Sing now.')], anchors: {} }],
    }))
    app.library = [{ entryId: 'saved-1', theme: 'My text', accent: 'GA', sentences: [sentence('Dance now.')], anchors: {} }]

    await openExercise('tiny/one')
    expect(app.open).toEqual({ kind: 'pool', poolId: 'tiny', packId: 'one' })
    expect(app.drill.theme).toBe('Rumi')

    await openExercise('saved-1')
    expect(app.open).toEqual({ kind: 'library', entryId: 'saved-1' })
    expect(app.drill.theme).toBe('My text')
  })
})
