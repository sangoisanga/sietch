import { describe, expect, it } from 'vitest'
import { putClip } from '../data/audioClips'
import { providers, isLlmConfigured, refreshAudioState, themeFallback } from './actions'
import { app, speakOptions } from './app.svelte'

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
  const sentence = (en: string) => ({ en, ipa: '', vi: '', tips: [] })

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
