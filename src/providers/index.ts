import type { Settings } from '../core/settings'
import { createGeminiLlm } from './llm/gemini'
import type { LlmProvider } from './llm/types'
import { createBrowserTts } from './tts/browser'
import { createGeminiTts } from './tts/gemini'
import type { TtsProvider } from './tts/types'

export interface ProviderDeps {
  getSettings: () => Settings
  rememberTextModel: (model: string) => void
}

export interface Providers {
  tts: TtsProvider[]
  llm: LlmProvider[]
  activeTts: () => TtsProvider
  activeLlm: () => LlmProvider
}

function pick<T extends { id: string; isConfigured(): boolean }>(all: T[], preferredId: string): T {
  const preferred = all.find(provider => provider.id === preferredId)
  if (preferred?.isConfigured()) return preferred
  return all.find(provider => provider.isConfigured()) ?? all[all.length - 1]!
}

export function createProviders({ getSettings, rememberTextModel }: ProviderDeps): Providers {
  const tts = [createGeminiTts(getSettings), createBrowserTts()]
  const llm = [createGeminiLlm({ getSettings, rememberTextModel })]

  return {
    tts,
    llm,
    activeTts: () => pick(tts, getSettings().ttsProviderId),
    activeLlm: () => pick(llm, getSettings().llmProviderId),
  }
}
