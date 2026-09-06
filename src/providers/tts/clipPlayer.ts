import { tokenize } from '../../core/text'
import type { ClipStore, PrefetchedAudio, SpeakOptions, SpeechHandle, TtsProvider, WordIndexListener } from './types'

interface Clip extends PrefetchedAudio {
  wordTimes: [number, number][]
}

function syllableCount(word: string): number {
  const vowelRuns = word.toLowerCase().replace(/[^a-z]/g, '').match(/[aeiouy]+/g)
  return Math.max(1, vowelRuns ? vowelRuns.length : 1)
}

function spokenWeight(word: string): number {
  let weight = syllableCount(word)
  if (/[,;:—-]$/.test(word)) weight += 0.7
  if (/[.?!]$/.test(word)) weight += 1
  return weight
}

function estimateWordTimes(text: string, durationSeconds: number): [number, number][] {
  const weights = tokenize(text).map(spokenWeight)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const leadIn = durationSeconds * 0.04
  const span = durationSeconds * 0.94

  let cursor = leadIn
  return weights.map(weight => {
    const start = cursor
    cursor += span * weight / total
    return [start, cursor]
  })
}

async function measureDuration(blobUrl: string): Promise<number> {
  // keeps the module importable outside a browser; a zero duration only costs word timing
  if (typeof Audio === 'undefined') return 0

  return new Promise(resolve => {
    const probe = new Audio()
    probe.src = blobUrl
    probe.onloadedmetadata = () => resolve(probe.duration || 0)
    probe.onerror = () => resolve(0)
  })
}

export function createClipPlayer(
  synthesize: (text: string, options: SpeakOptions) => Promise<Blob>,
  cacheKey: (text: string, options: SpeakOptions) => string,
  store?: ClipStore,
): Pick<TtsProvider, 'speak' | 'prefetch' | 'cacheKey' | 'release'> {
  const clips = new Map<string, Clip>()

  async function getClip(text: string, options: SpeakOptions): Promise<Clip> {
    const key = cacheKey(text, options)
    const cached = clips.get(key)
    if (cached) return cached

    const stored = await store?.get(key)
    const blob = stored?.blob ?? await synthesize(text, options)
    const downloadUrl = URL.createObjectURL(blob)
    const durationSeconds = stored?.durationSeconds ?? await measureDuration(downloadUrl)
    const clip: Clip = { downloadUrl, durationSeconds, wordTimes: estimateWordTimes(text, durationSeconds) }

    clips.set(key, clip)
    if (!stored) await store?.put({ key, text, blob, durationSeconds })
    return clip
  }

  return {
    cacheKey,
    prefetch: (text, options) => getClip(text, options),

    speak(text: string, options: SpeakOptions, onWordIndex: WordIndexListener): SpeechHandle {
      const audio = new Audio()
      let stopped = false
      let frame = 0

      const stop = () => {
        stopped = true
        cancelAnimationFrame(frame)
        audio.pause()
        onWordIndex(null)
      }

      const finished = (async () => {
        const clip = await getClip(text, options)
        if (stopped) return

        audio.src = clip.downloadUrl
        audio.playbackRate = options.rate
        const ended = new Promise<void>(resolve => {
          audio.onended = () => resolve()
          audio.onerror = () => resolve()
        })

        await audio.play()

        const highlight = () => {
          const at = audio.currentTime
          const index = clip.wordTimes.findIndex(([start, end]) => at >= start && at < end)
          onWordIndex(index < 0 ? null : index)
          if (!audio.paused) frame = requestAnimationFrame(highlight)
        }
        frame = requestAnimationFrame(highlight)

        await ended
        cancelAnimationFrame(frame)
        onWordIndex(null)
      })()

      return { finished, stop }
    },

    release() {
      for (const clip of clips.values()) URL.revokeObjectURL(clip.downloadUrl)
      clips.clear()
    },
  }
}
