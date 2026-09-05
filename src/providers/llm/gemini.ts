import type { Settings } from '../../core/settings'
import { GeminiError, MISSING_KEY, generateContent, partsOf } from '../gemini/client'
import { parseLooseJson } from './json'
import type { LlmProvider } from './types'

const TEXT_MODEL_CANDIDATES = ['gemini-flash-latest', 'gemini-3.1-flash', 'gemini-3.7-flash', 'gemini-2.5-flash']

export interface GeminiLlmDeps {
  getSettings: () => Settings
  rememberTextModel: (model: string) => void
}

export function createGeminiLlm({ getSettings, rememberTextModel }: GeminiLlmDeps): LlmProvider {
  return {
    id: 'gemini',
    label: 'Gemini',
    isConfigured: () => Boolean(getSettings().apiKey),

    async generateJson<T>(prompt: string, temperature: number): Promise<T> {
      const { apiKey, textModel } = getSettings()
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature },
      }

      const candidates = textModel ? [textModel, ...TEXT_MODEL_CANDIDATES] : TEXT_MODEL_CANDIDATES
      let lastError: unknown

      for (const model of candidates) {
        try {
          const response = await generateContent(model, apiKey, body)
          rememberTextModel(model)
          const text = partsOf(response).map(part => part.text ?? '').join('')
          return parseLooseJson<T>(text)
        } catch (error) {
          if (error instanceof GeminiError && error.message === MISSING_KEY) throw error
          lastError = error
          // only a missing/rejected model is worth retrying on the next candidate
          const status = error instanceof GeminiError ? error.status : undefined
          if (status !== 404 && status !== 400) throw error
        }
      }

      throw lastError ?? new Error('No Gemini text model responded.')
    },
  }
}
