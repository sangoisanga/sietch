import type { Accent } from '../../core/accents'
import type { Describable } from '../types'

// delivery style is one provider's prompt trick, so it lives in that provider's
// config rather than in the options every provider receives
export interface SpeakOptions {
  accent: Accent
  rate: number
}

export interface PrefetchedAudio {
  downloadUrl: string
  durationSeconds: number
}

export interface SpeechHandle {
  finished: Promise<void>
  stop(): void
}

export type WordIndexListener = (index: number | null) => void

export interface TtsProvider extends Describable {
  speak(text: string, options: SpeakOptions, onWordIndex: WordIndexListener): SpeechHandle
  prefetch?(text: string, options: SpeakOptions): Promise<PrefetchedAudio>
  release?(): void
}
