export type ProviderConfig = Record<string, string>

export type ThemeMode = 'light' | 'dark'

export interface Settings {
  themeMode: ThemeMode
  ttsProviderId: string
  llmProviderId: string
  rate: number
  providers: Record<string, ProviderConfig>
}

export const GEMINI_DEFAULTS: ProviderConfig = {
  apiKey: '',
  textModel: '',
  ttsModel: 'gemini-3.1-flash-tts-preview',
  voice: 'Kore',
  style: 'slow',
}

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'light',
  ttsProviderId: 'gemini',
  llmProviderId: 'gemini',
  rate: 1,
  providers: { gemini: { ...GEMINI_DEFAULTS } },
}
