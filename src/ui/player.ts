import { resolveAccent } from '../core/accents'
import type { Providers } from '../providers'
import type { SpeakOptions, SpeechHandle } from '../providers/tts/types'
import { state } from '../state'
import { el } from './dom'
import { clearHighlight, highlightWord, setActiveCard, setProgress, setStatus, showClip } from './render'
import { STRINGS } from './strings'

const SHADOW_PACE = 1150
const MS_PER_CHARACTER = 70

export interface Player {
  sayOne(index: number): Promise<void>
  loopThree(index: number): Promise<void>
  playAll(): Promise<void>
  regenerate(index: number): Promise<void>
  prefetchAll(onStep: (done: number, sentence: string) => void): Promise<number>
  stop(): void
  releaseAudio(): void
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function createPlayer(providers: Providers): Player {
  let speaking: SpeechHandle | null = null

  const speakOptions = (): SpeakOptions => ({
    accent: resolveAccent(state.drill.accent),
    style: state.settings.style,
    rate: state.settings.rate,
  })

  function reportProgress(sentenceIndex: number, wordIndex: number | null, wordCount: number): void {
    const withinSentence = wordIndex === null ? 0 : (wordIndex + 1) / wordCount
    setProgress((sentenceIndex + withinSentence) / state.drill.sentences.length)
  }

  async function sayOne(index: number): Promise<void> {
    const sentence = state.drill.sentences[index]
    if (!sentence) return

    setActiveCard(index)
    const wordCount = sentence.en.split(/\s+/).filter(Boolean).length
    const handle = providers.activeTts().speak(sentence.en, speakOptions(), wordIndex => {
      highlightWord(index, wordIndex)
      reportProgress(index, wordIndex, wordCount)
    })

    speaking = handle
    try {
      await handle.finished
    } finally {
      speaking = null
      clearHighlight()
    }
  }

  async function shadowGap(index: number): Promise<void> {
    if (!state.toggles.shadow) return
    const sentence = state.drill.sentences[index]
    if (!sentence) return

    let gap = sentence.en.length * MS_PER_CHARACTER
    const { prefetch } = providers.activeTts()
    if (prefetch) {
      try {
        const clip = await prefetch(sentence.en, speakOptions())
        gap = clip.durationSeconds / state.settings.rate * SHADOW_PACE
      } catch {
        // no clip to measure — the character-count estimate stands
      }
    }

    setStatus(STRINGS.yourTurn(index), 'shadow')
    const until = Date.now() + gap
    while (Date.now() < until) {
      if (state.stopRequested) return
      await wait(80)
    }
    setStatus(STRINGS.ready)
  }

  async function prefetchSentence(index: number): Promise<void> {
    const sentence = state.drill.sentences[index]
    const { prefetch } = providers.activeTts()
    if (!sentence || !prefetch) return
    showClip(index, await prefetch(sentence.en, speakOptions()))
  }

  return {
    sayOne: async index => {
      state.stopRequested = false
      await sayOne(index)
      await shadowGap(index)
    },

    loopThree: async index => {
      state.stopRequested = false
      for (let round = 0; round < 3; round++) {
        if (state.stopRequested) break
        await sayOne(index)
        await shadowGap(index)
        await wait(300)
      }
    },

    playAll: async () => {
      if (state.playing) return
      state.playing = true
      state.stopRequested = false
      el('playAll').classList.add('on')

      for (let index = 0; index < state.drill.sentences.length; index++) {
        if (state.stopRequested) break
        await sayOne(index)
        if (state.stopRequested) break
        await shadowGap(index)
        await wait(200)
      }

      setActiveCard(-1)
      state.playing = false
      el('playAll').classList.remove('on')
      setProgress(0)
      if (!state.stopRequested) setStatus(STRINGS.passageEnd)
    },

    regenerate: async index => {
      providers.activeTts().release?.()
      await prefetchSentence(index)
    },

    prefetchAll: async onStep => {
      state.stopRequested = false
      let done = 0
      for (const [index, sentence] of state.drill.sentences.entries()) {
        if (state.stopRequested) break
        onStep(index, sentence.en)
        setStatus(STRINGS.generatingSentence(index))
        await prefetchSentence(index)
        done = index + 1
        onStep(done, sentence.en)
      }
      return done
    },

    stop: () => {
      state.stopRequested = true
      state.playing = false
      el('playAll').classList.remove('on')
      speaking?.stop()
      speaking = null
      clearHighlight()
      setActiveCard(-1)
      setProgress(0)
      setStatus(STRINGS.stopped)
    },

    releaseAudio: () => providers.tts.forEach(provider => provider.release?.()),
  }
}
