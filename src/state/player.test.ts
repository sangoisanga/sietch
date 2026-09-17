import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Providers } from '../providers'
import type { SpeechHandle, TtsProvider } from '../providers/tts/types'
import { app } from './app.svelte'
import { createPlayer } from './player'

const sentence = (en: string) => ({ en, ipa: '', vi: '', tips: [] })

function fakeProviders(spoken: string[]): Providers {
  const tts: TtsProvider = {
    id: 'fake',
    label: 'Fake',
    settingsFields: [],
    isConfigured: () => true,
    speak: (text): SpeechHandle => {
      spoken.push(text)
      return { finished: new Promise(resolve => setTimeout(resolve, 0)), stop: () => {} }
    },
  }
  return { tts: [tts], llm: [], activeTts: () => tts, activeLlm: () => { throw new Error('no LLM in this test') } }
}

beforeEach(() => {
  app.toggles.shadow = false
  app.resumeAt = -1
  app.playing = false
  app.stopRequested = false
})

describe('player playback', () => {
  it('plays every sentence and clears the resume point at the end', async () => {
    const spoken: string[] = []
    const player = createPlayer(fakeProviders(spoken))
    app.drill = { theme: 'Test', accent: 'GA', anchors: {}, sentences: [sentence('One.'), sentence('Two.')] }

    await player.playAll()

    expect(spoken).toEqual(['One.', 'Two.'])
    expect(app.resumeAt).toBe(-1)
  })

  it('resumes from the sentence that was playing when paused', async () => {
    const spoken: string[] = []
    const player = createPlayer(fakeProviders(spoken))
    app.drill = { theme: 'Test', accent: 'GA', anchors: {}, sentences: [sentence('One.'), sentence('Two.'), sentence('Three.')] }

    const run = player.playAll()
    await vi.waitFor(() => expect(spoken).toHaveLength(2))
    player.pause()
    await run

    expect(app.resumeAt).toBe(1)

    spoken.length = 0
    await player.playAll()
    expect(spoken).toEqual(['Two.', 'Three.'])
  })

  it('lets a single-card play break the passage run', async () => {
    const spoken: string[] = []
    const player = createPlayer(fakeProviders(spoken))
    app.drill = { theme: 'Test', accent: 'GA', anchors: {}, sentences: [sentence('One.'), sentence('Two.'), sentence('Three.')] }

    const run = player.playAll()
    await vi.waitFor(() => expect(spoken).toEqual(['One.']))
    await player.sayOne(2)
    await run

    expect(spoken).toEqual(['One.', 'Three.'])
    expect(app.resumeAt).toBe(2)
  })
})
