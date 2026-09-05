import { resolveAccent } from '../core/accents'
import { estimatedShadowGapMs, shadowGapMs } from '../core/shadow'
import type { Providers } from '../providers'
import type { SpeakOptions, SpeechHandle } from '../providers/tts/types'
import { STRINGS } from '../ui/strings'
import { app, setStatus } from './app.svelte'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface Player {
  sayOne(index: number): Promise<void>
  loopThree(index: number): Promise<void>
  playAll(): Promise<void>
  regenerate(index: number): Promise<void>
  prefetchAll(onStep: (done: number, sentence: string) => void): Promise<number>
  stop(): void
  releaseAudio(): void
}

export function createPlayer(providers: Providers): Player {
  let speaking: SpeechHandle | null = null

  const speakOptions = (): SpeakOptions => ({
    accent: resolveAccent(app.drill.accent),
    style: app.settings.style,
    rate: app.settings.rate,
  })

  async function speakSentence(index: number): Promise<void> {
    const sentence = app.drill.sentences[index]
    if (!sentence) return

    app.activeCard = index
    const wordCount = sentence.en.split(/\s+/).filter(Boolean).length
    const handle = providers.activeTts().speak(sentence.en, speakOptions(), wordIndex => {
      app.litWord = wordIndex ?? -1
      const withinSentence = wordIndex === null ? 0 : (wordIndex + 1) / wordCount
      app.progress = (index + withinSentence) / app.drill.sentences.length
    })

    speaking = handle
    try {
      await handle.finished
    } finally {
      speaking = null
      app.litWord = -1
    }
  }

  async function shadowGap(index: number): Promise<void> {
    if (!app.toggles.shadow) return
    const sentence = app.drill.sentences[index]
    if (!sentence) return

    let gap = estimatedShadowGapMs(sentence.en, app.shadowPace)
    const { prefetch } = providers.activeTts()
    if (prefetch) {
      try {
        const clip = await prefetch(sentence.en, speakOptions())
        gap = shadowGapMs(clip.durationSeconds, app.settings.rate, app.shadowPace)
      } catch {
        // no clip to measure — the character-count estimate stands
      }
    }

    setStatus(STRINGS.yourTurn(index, Math.round(gap / 1000)), 'shadow')
    const until = Date.now() + gap
    while (Date.now() < until) {
      if (app.stopRequested) return
      await wait(80)
    }
    setStatus(STRINGS.ready)
  }

  async function prefetchSentence(index: number): Promise<void> {
    const sentence = app.drill.sentences[index]
    const { prefetch } = providers.activeTts()
    if (!sentence || !prefetch) return
    app.clips = { ...app.clips, [index]: await prefetch(sentence.en, speakOptions()) }
  }

  return {
    sayOne: async index => {
      app.stopRequested = false
      await speakSentence(index)
      await shadowGap(index)
    },

    loopThree: async index => {
      app.stopRequested = false
      for (let round = 0; round < 3; round++) {
        if (app.stopRequested) break
        await speakSentence(index)
        await shadowGap(index)
        await wait(300)
      }
    },

    playAll: async () => {
      if (app.playing) return
      app.playing = true
      app.stopRequested = false

      for (let index = 0; index < app.drill.sentences.length; index++) {
        if (app.stopRequested) break
        await speakSentence(index)
        if (app.stopRequested) break
        await shadowGap(index)
        await wait(200)
      }

      app.activeCard = -1
      app.playing = false
      app.progress = 0
      if (!app.stopRequested) setStatus(STRINGS.passageEnd)
    },

    regenerate: async index => {
      providers.activeTts().release?.()
      await prefetchSentence(index)
    },

    prefetchAll: async onStep => {
      app.stopRequested = false
      let done = 0
      for (const [index, sentence] of app.drill.sentences.entries()) {
        if (app.stopRequested) break
        onStep(index, sentence.en)
        setStatus(STRINGS.generatingSentence(index))
        await prefetchSentence(index)
        done = index + 1
        onStep(done, sentence.en)
      }
      return done
    },

    stop: () => {
      app.stopRequested = true
      app.playing = false
      speaking?.stop()
      speaking = null
      app.litWord = -1
      app.activeCard = -1
      app.progress = 0
      setStatus(STRINGS.stopped)
    },

    releaseAudio: () => {
      providers.tts.forEach(provider => provider.release?.())
      app.clips = {}
    },
  }
}
