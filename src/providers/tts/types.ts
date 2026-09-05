import type { Accent } from '../../core/accents'
import type { SpeakingStyle } from '../../types'

export type { SpeakingStyle }

export interface SpeakOptions {
  accent: Accent
  style: SpeakingStyle
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

export interface TtsProvider {
  id: string
  label: string
  isConfigured(): boolean
  speak(text: string, options: SpeakOptions, onWordIndex: WordIndexListener): SpeechHandle
  prefetch?(text: string, options: SpeakOptions): Promise<PrefetchedAudio>
  release?(): void
}
