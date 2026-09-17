import { estimatedShadowGapMs, shadowGapMs } from '../core/shadow'
import { deleteClip } from '../data/audioClips'
import type { Providers } from '../providers'
import type { SpeechHandle } from '../providers/tts/types'
import { STRINGS } from '../ui/strings'
import { app, setStatus, speakOptions } from './app.svelte'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface Player {
  sayOne(index: number): Promise<void>
  loopThree(index: number): Promise<void>
  playAll(): Promise<void>
  regenerate(index: number): Promise<void>
  prefetchAll(onStep: (done: number, sentence: string) => void): Promise<number>
  pause(): void
}

export function createPlayer(providers: Providers): Player {
  let speaking: SpeechHandle | null = null
  let runId = 0

  function beginRun(): number {
    runId += 1
    app.playing = false
    app.stopRequested = false
    speaking?.stop()
    speaking = null
    app.litWord = -1
    return runId
  }

  async function speakSentence(index: number, run: number): Promise<void> {
    const sentence = app.drill.sentences[index]
    if (!sentence) return

    app.activeCard = index
    app.resumeAt = index
    const wordCount = sentence.en.split(/\s+/).filter(Boolean).length
    const handle = providers.activeTts().speak(sentence.en, speakOptions(), wordIndex => {
      if (runId !== run) return
      app.litWord = wordIndex ?? -1
      const withinSentence = wordIndex === null ? 0 : (wordIndex + 1) / wordCount
      app.progress = (index + withinSentence) / app.drill.sentences.length
    })

    speaking = handle
    try {
      await handle.finished
    } finally {
      if (runId === run) {
        speaking = null
        app.litWord = -1
      }
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
    app.audioReady = new Set(app.audioReady).add(sentence.en)
  }

  return {
    sayOne: async index => {
      const run = beginRun()
      await speakSentence(index, run)
      await shadowGap(index)
    },

    loopThree: async index => {
      const run = beginRun()
      for (let round = 0; round < 3; round++) {
        if (runId !== run) break
        await speakSentence(index, run)
        await shadowGap(index)
        await wait(300)
      }
    },

    playAll: async () => {
      if (app.playing) return
      const run = beginRun()
      app.playing = true

      for (let index = Math.max(0, app.resumeAt); index < app.drill.sentences.length; index++) {
        if (runId !== run) return
        await speakSentence(index, run)
        if (runId !== run) return
        await shadowGap(index)
        await wait(200)
      }

      if (runId !== run) return
      app.activeCard = -1
      app.playing = false
      app.progress = 0
      app.resumeAt = -1
      setStatus(STRINGS.passageEnd)
    },

    regenerate: async index => {
      const sentence = app.drill.sentences[index]
      const { cacheKey, release } = providers.activeTts()
      // without dropping the stored clip, a regenerate would just replay the take it is replacing
      if (sentence && cacheKey) await deleteClip(cacheKey(sentence.en, speakOptions()))
      release?.()
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

    pause: () => {
      beginRun()
      app.stopRequested = true
      app.playing = false
      app.progress = app.resumeAt >= 0 ? app.resumeAt / app.drill.sentences.length : 0
      setStatus(STRINGS.paused)
    },
  }
}
