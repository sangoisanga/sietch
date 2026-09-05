import type { SpeakingStyle } from '../providers/tts/types'

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

const STORAGE_KEY = 'df_settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // storage blocked (private mode, quota) — the session still works, it just will not persist
  }
}
