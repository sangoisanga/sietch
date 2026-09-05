import type { Settings } from '../../core/settings'
import { bare, tokenize } from '../../core/text'
import { generateContent, partsOf } from '../gemini/client'
import type { PrefetchedAudio, SpeakOptions, SpeakingStyle, SpeechHandle, TtsProvider, WordIndexListener } from './types'
import { base64ToBytes, pcmToWav, sampleRateFromMimeType } from './wav'

export const GEMINI_VOICES = ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Achird', 'Vindemiatrix', 'Sadachbia', 'Sulafat', 'Callirrhoe', 'Autonoe', 'Zubenelgenubi', 'Sadaltager', 'Pulcherrima']

const STYLE_INSTRUCTIONS: Record<SpeakingStyle, string> = {
  slow: 'Read slowly and very clearly, for a language learner to imitate, keeping natural linking and rhythm, in a {ACCENT} accent:',
  natural: 'Read at a natural relaxed pace with natural linking, weak forms and rhythm, in a {ACCENT} accent:',
  veryslow: 'Read very slowly, one word at a time, over-articulating every consonant, in a {ACCENT} accent:',
}

function syllableCount(word: string): number {
  const vowelRuns = bare(word).match(/[aeiouy]+/g)
  return Math.max(1, vowelRuns ? vowelRuns.length : 1)
}

function spokenWeight(word: string): number {
  let weight = syllableCount(word)
  if (/[,;:—-]$/.test(word)) weight += 0.7
  if (/[.?!]$/.test(word)) weight += 1
  return weight
}

// Gemini returns audio with no word boundaries, so spans are estimated from
// syllable count and trailing punctuation. Replace if the API ever emits timings.
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

interface Clip extends PrefetchedAudio {
  wordTimes: [number, number][]
}

async function measureDuration(blobUrl: string): Promise<number> {
  return new Promise(resolve => {
    const probe = new Audio()
    probe.src = blobUrl
    probe.onloadedmetadata = () => resolve(probe.duration || 0)
    probe.onerror = () => resolve(0)
  })
}

export function createGeminiTts(getSettings: () => Settings): TtsProvider {
  const clips = new Map<string, Clip>()

  const cacheKey = (text: string, options: SpeakOptions) =>
    [text, options.style, getSettings().voice, options.accent.code].join('|')

  async function synthesize(text: string, options: SpeakOptions): Promise<Clip> {
    const key = cacheKey(text, options)
    const cached = clips.get(key)
    if (cached) return cached

    const { apiKey, ttsModel, voice } = getSettings()
    const instruction = STYLE_INSTRUCTIONS[options.style].replace('{ACCENT}', options.accent.ttsDescription)
    const response = await generateContent(ttsModel, apiKey, {
      contents: [{ parts: [{ text: `${instruction} ${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    })

    const audioPart = partsOf(response).find(part => part.inlineData)
    if (!audioPart?.inlineData) throw new Error('The response carried no audio.')

    const wav = pcmToWav(base64ToBytes(audioPart.inlineData.data), sampleRateFromMimeType(audioPart.inlineData.mimeType))
    const downloadUrl = URL.createObjectURL(wav)
    const durationSeconds = await measureDuration(downloadUrl)
    const clip: Clip = { downloadUrl, durationSeconds, wordTimes: estimateWordTimes(text, durationSeconds) }

    clips.set(key, clip)
    return clip
  }

  return {
    id: 'gemini',
    label: 'Gemini voice',
    isConfigured: () => Boolean(getSettings().apiKey),

    prefetch: (text, options) => synthesize(text, options),

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
        const clip = await synthesize(text, options)
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
