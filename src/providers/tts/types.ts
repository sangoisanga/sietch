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

export interface StoredClip {
  key: string
  text: string
  blob: Blob
  durationSeconds: number
}

// implemented in data/, injected here: a provider must never reach for a database itself
export interface ClipStore {
  get(key: string): Promise<StoredClip | undefined>
  put(clip: StoredClip): Promise<void>
}

export interface SpeechHandle {
  finished: Promise<void>
  stop(): void
}

export type WordIndexListener = (index: number | null) => void

export interface TtsProvider extends Describable {
  speak(text: string, options: SpeakOptions, onWordIndex: WordIndexListener): SpeechHandle
  prefetch?(text: string, options: SpeakOptions): Promise<PrefetchedAudio>
  cacheKey?(text: string, options: SpeakOptions): string
  release?(): void
}
