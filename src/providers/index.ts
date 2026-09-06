import type { Settings } from '../core/settings'
import { createGeminiLlm } from './llm/gemini'
import type { LlmProvider } from './llm/types'
import { createOpenRouterLlm } from './openrouter/llm'
import { createOpenRouterTts } from './openrouter/tts'
import { createBrowserTts } from './tts/browser'
import { createGeminiTts } from './tts/gemini'
import type { TtsProvider } from './tts/types'
import type { ProviderContext } from './types'

export interface ProviderDeps {
  getSettings: () => Settings
  updateSettings: (patch: Partial<Settings>) => void
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

// each provider is bound to its own entry, so one can neither read nor overwrite another's config
function providerContext(getSettings: () => Settings, updateSettings: (patch: Partial<Settings>) => void, id: string): ProviderContext {
  return {
    config: () => getSettings().providers[id] ?? {},
    update: patch => {
      const current = getSettings().providers[id] ?? {}
      updateSettings({ providers: { ...getSettings().providers, [id]: { ...current, ...patch } } })
    },
  }
}

export function createProviders({ getSettings, updateSettings }: ProviderDeps): Providers {
  const gemini = providerContext(getSettings, updateSettings, 'gemini')
  const openrouter = providerContext(getSettings, updateSettings, 'openrouter')

  const tts = [createGeminiTts(gemini), createOpenRouterTts(openrouter), createBrowserTts()]
  const llm = [createGeminiLlm(gemini), createOpenRouterLlm(openrouter)]

  return {
    tts,
    llm,
    activeTts: () => pick(tts, getSettings().ttsProviderId),
    activeLlm: () => pick(llm, getSettings().llmProviderId),
  }
}
