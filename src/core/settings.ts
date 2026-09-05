import type { SpeakingStyle } from '../types'

export interface Settings {
  apiKey: string
  textModel: string
  ttsModel: string
  voice: string
  style: SpeakingStyle
  ttsProviderId: string
  llmProviderId: string
  rate: number
}

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  textModel: '',
  ttsModel: 'gemini-3.1-flash-tts-preview',
  voice: 'Kore',
  style: 'slow',
  ttsProviderId: 'gemini',
  llmProviderId: 'gemini',
  rate: 1,
}
