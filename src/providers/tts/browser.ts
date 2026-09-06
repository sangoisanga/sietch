import { tokenize } from '../../core/text'
import type { SpeakOptions, SpeechHandle, TtsProvider, WordIndexListener } from './types'

function wordStartOffsets(text: string): number[] {
  const offsets: number[] = []
  let cursor = 0
  for (const word of tokenize(text)) {
    offsets.push(cursor)
    cursor += word.length + 1
  }
  return offsets
}

const hasSpeechSynthesis = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window

function pickVoice(bcp47: string): SpeechSynthesisVoice | undefined {
  return speechSynthesis.getVoices().find(voice => voice.lang.replace('_', '-') === bcp47)
}

export function createBrowserTts(): TtsProvider {
  return {
    id: 'browser',
    label: 'Browser voice',
    settingsFields: [],
    isConfigured: hasSpeechSynthesis,

    speak(text: string, options: SpeakOptions, onWordIndex: WordIndexListener): SpeechHandle {
      if (!hasSpeechSynthesis()) {
        return { finished: Promise.reject(new Error('This browser has no speech synthesis.')), stop: () => {} }
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = options.accent.bcp47
      utterance.rate = options.rate * 0.9
      const voice = pickVoice(options.accent.bcp47)
      if (voice) utterance.voice = voice

      const offsets = wordStartOffsets(text)
      utterance.onboundary = event => {
        if (event.name && event.name !== 'word') return
        let index = 0
        for (let i = 0; i < offsets.length; i++) if (offsets[i]! <= event.charIndex) index = i
        onWordIndex(index)
      }

      const finished = new Promise<void>(resolve => {
        utterance.onend = () => { onWordIndex(null); resolve() }
        utterance.onerror = () => { onWordIndex(null); resolve() }
      })

      speechSynthesis.cancel()
      speechSynthesis.speak(utterance)

      return {
        finished,
        stop: () => { speechSynthesis.cancel(); onWordIndex(null) },
      }
    },
  }
}
